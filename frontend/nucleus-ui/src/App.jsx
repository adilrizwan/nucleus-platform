import React, { useEffect, useState } from 'react';
import { 
  CssBaseline, ThemeProvider, createTheme, Container, Typography, 
  Box, IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Tooltip as MuiTooltip, Card, CardContent, CardActions, Grid, Divider, CircularProgress, Slider, FormLabel, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import { Edit, Delete, ShowChart, Memory } from '@mui/icons-material';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// Theme Configuration
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    background: { default: '#f8fafc', paper: '#ffffff' },
  },
  typography: { fontFamily: 'Inter, -apple-system, sans-serif' },
});

const API_BASE = 'http://localhost:61443/api/v1';

function CircularGauge({ value, label, color, subtext }) {
  const size = 42; 
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '33%' }}>
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <CircularProgress variant="determinate" value={100} sx={{ color: '#e2e8f0', position: 'absolute', top: 0, left: 0 }} size={size} thickness={4.5} />
        <CircularProgress variant="determinate" value={value} color={color} size={size} thickness={4.5} sx={{ position: 'absolute', top: 0, left: 0 }} />
        <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }} color="textPrimary">{Math.round(value)}%</Typography>
        </Box>
      </Box>
      <Typography variant="caption" fontWeight="bold" color="textSecondary" sx={{ mt: 0.5, fontSize: '0.6rem', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Typography>
      {subtext && <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.55rem', opacity: 0.8 }}>{subtext}</Typography>}
    </Box>
  );
}

export default function App() {
  const [servers, setServers] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [activeServer, setActiveServer] = useState(null);
  const [editForm, setEditForm] = useState({ alias: '', group_name: '' });
  const [telemetryData, setTelemetryData] = useState([]);
  
  // Time range state tracker
  const [timeRange, setTimeRange] = useState('1h');

  const fetchFleet = async () => {
    try {
      const res = await fetch(`${API_BASE}/servers`);
      const data = await res.json();
      setServers(data);
    } catch (err) {
      console.error("Failed to fetch fleet:", err);
    }
  };

  const fetchTelemetry = async (serverId, currentRange) => {
    try {
      const res = await fetch(`${API_BASE}/servers/${serverId}/telemetry?range=${currentRange}`);
      const data = await res.json();
      if (Array.isArray(data)) setTelemetryData(data);
    } catch (err) {
      console.error("Failed to fetch telemetry:", err);
    }
  };

  const handleSaveMetadata = async () => {
    try {
      await fetch(`${API_BASE}/servers/${activeServer.server_id}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      setEditOpen(false);
      fetchFleet(); 
    } catch (err) {
      console.error("Failed to update metadata", err);
    }
  };

  const handleDeleteServer = async (serverId) => {
    if (!window.confirm("Are you sure you want to decommission this server?")) return;
    try {
      await fetch(`${API_BASE}/servers/${serverId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: "admin" })
      });
      fetchFleet(); 
    } catch (err) {
      console.error("Failed to decommission server", err);
    }
  };

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(fetchFleet, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval;
    if (chartOpen && activeServer) {
      fetchTelemetry(activeServer.server_id, timeRange);
      interval = setInterval(() => fetchTelemetry(activeServer.server_id, timeRange), 5000);
    }
    return () => clearInterval(interval);
  }, [chartOpen, activeServer, timeRange]);

  const openEdit = (server) => {
    setActiveServer(server);
    setEditForm({ 
      alias: server.alias || '', 
      group_name: server.group_name || '',
      heartbeat_interval: server.heartbeat_interval || 10,
      telemetry_interval: server.telemetry_interval || 300
    });
    setEditOpen(true);
  };

  const openChart = (server) => {
    setActiveServer(server);
    setChartOpen(true);
  };

  // DYNAMIC X-AXIS FORMATTER: Adjusts format based on selected timeframe
  const formatXAxis = (tickItem) => {
    const date = new Date(tickItem);
    if (timeRange === '1h' || timeRange === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '30d') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', year: 'numeric' }); // 1 Year scale
    }
  };

  // DYNAMIC TOOLTIP FORMATTER: Keeps the hover-data highly precise
  const formatTooltipDate = (label) => {
    const date = new Date(label);
    if (timeRange === '1h') return date.toLocaleTimeString();
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const groupedServers = servers.reduce((acc, server) => {
    const group = server.group_name || "Ungrouped";
    if (!acc[group]) acc[group] = [];
    acc[group].push(server);
    return acc;
  }, {});

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ mt: 5, mb: 5 }}>
        
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={6}>
          <Box display="flex" alignItems="center" gap={2}>
            <Memory color="primary" fontSize="large" />
            <Typography variant="h4" fontWeight="bold" color="textPrimary">
              Nucleus Control Plane
            </Typography>
          </Box>
          <Chip label="System Diagnostics Active" color="success" variant="outlined" sx={{ fontWeight: 'bold' }} />
        </Box>

        {Object.keys(groupedServers).length === 0 && (
          <Typography variant="h6" color="textSecondary" align="center" sx={{ mt: 10 }}>
            No active nodes detected. Ensure your infrastructure agents are reporting correctly.
          </Typography>
        )}

        {Object.entries(groupedServers).map(([groupName, groupServers]) => (
          <Box key={groupName} mb={5}>
            <Typography variant="h6" color="textSecondary" mb={2} sx={{ textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: 1, fontWeight: 'bold' }}>
              {groupName} ({groupServers.length})
            </Typography>
            
            <Grid container spacing={3}>
              {groupServers.map((server) => {
                const latestMetrics = server.telemetry && server.telemetry.length > 0 ? server.telemetry[0] : null;

                return (
                  <Grid item xs={12} sm={6} lg={4} xl={3} key={server.server_id}>
                    <Card sx={{ 
                      borderRadius: 3, 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)', 
                      border: '1px solid #e2e8f0',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }
                    }}>
                      <CardContent sx={{ pb: 1 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                          <Box overflow="hidden">
                            <Typography variant="h6" fontWeight="bold" noWrap title={server.alias || server.hostname}>
                              {server.alias || server.hostname}
                            </Typography>
                            {server.alias && (
                              <Typography variant="caption" color="textSecondary" display="block" noWrap>
                                {server.hostname}
                              </Typography>
                            )}
                          </Box>
                          <Chip label={server.status} color={server.status === 'ONLINE' ? 'success' : 'error'} size="small" sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 24, ml: 1 }} />
                        </Box>

                        <Box display="flex" flexDirection="column" gap={0.5} mb={2.5}>
                          <Typography variant="body2" color="textSecondary">
                            <strong>IPv4:</strong> <span style={{ fontFamily: 'monospace' }}>{server.ip_address}</span>
                          </Typography>
                          <Typography variant="body2" color="textSecondary" noWrap>
                            <strong>OS Architecture:</strong> {server.os_release}
                          </Typography>
                        </Box>

                        {latestMetrics ? (
                          <Box sx={{ display: 'flex !important', flexDirection: 'row !important', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap !important', backgroundColor: '#f8fafc', p: 1.5, borderRadius: 2.5, border: '1px solid #f1f5f9', width: '100%' }}>
                            <CircularGauge value={latestMetrics.cpu_usage_pct} label="CPU" color={latestMetrics.cpu_usage_pct > 80 ? "error" : "primary"} subtext={`${server.total_cores || '?'} Cores`} />
                            <CircularGauge value={latestMetrics.ram_usage_pct} label="RAM" color={latestMetrics.ram_usage_pct > 85 ? "error" : "success"} subtext={`${server.total_ram_gb || '?'} GB`} />
                            <CircularGauge value={latestMetrics.storage_root_pct} label="Disk" color={latestMetrics.storage_root_pct > 90 ? "error" : "warning"} subtext={`${server.total_disk_gb || '?'} GB`} />
                          </Box>
                        ) : (
                          <Typography variant="caption" color="textSecondary" display="block" align="center" sx={{ py: 2.5 }}>Awaiting resource telemetry streaming...</Typography>
                        )}
                      </CardContent>
                      <Divider sx={{ mt: 1 }} />
                      <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1.5, backgroundColor: '#fafbfc' }}>
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>Last Update: {new Date(server.last_seen_at).toLocaleTimeString()}</Typography>
                        <Box>
                          <MuiTooltip title="Historical Trends"><IconButton color="primary" onClick={() => openChart(server)} size="small"><ShowChart fontSize="small" /></IconButton></MuiTooltip>
                          <MuiTooltip title="Modify Server Group"><IconButton color="default" onClick={() => openEdit(server)} size="small"><Edit fontSize="small" /></IconButton></MuiTooltip>
                          <MuiTooltip title="Decommission Server"><IconButton color="error" onClick={() => handleDeleteServer(server.server_id)} size="small"><Delete fontSize="small" /></IconButton></MuiTooltip>
                        </Box>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ))}

        {/* MODAL 1: Edit Alias & Group */}
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle fontWeight="bold">Edit Server Metadata</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={3} mt={1}>
              <TextField label="Server Alias (Display Name)" variant="outlined" value={editForm.alias} onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })} fullWidth />
              <TextField label="Group Name (e.g., Web Servers, Database)" variant="outlined" value={editForm.group_name} onChange={(e) => setEditForm({ ...editForm, group_name: e.target.value })} fullWidth />
              <Divider sx={{ my: 1 }} />
              <Box>
                <FormLabel sx={{ fontWeight: 'bold', mb: 1, display: 'block' }}>Heartbeat Ping Interval (Availability)</FormLabel>
                <Slider value={editForm.heartbeat_interval} onChange={(e, val) => setEditForm({ ...editForm, heartbeat_interval: val })} step={5} min={5} max={60} valueLabelDisplay="auto" marks={[{value: 5, label: '5s'}, {value: 60, label: '60s'}]} />
              </Box>
              <Box>
                <FormLabel sx={{ fontWeight: 'bold', mb: 1, display: 'block' }}>Resource Telemetry Interval (Performance)</FormLabel>
                <Slider value={editForm.telemetry_interval} onChange={(e, val) => setEditForm({ ...editForm, telemetry_interval: val })} step={60} min={60} max={600} valueLabelDisplay="auto" valueLabelFormat={(val) => `${val / 60}m`} marks={[{value: 60, label: '1m'}, {value: 600, label: '10m'}]} />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" disableElevation onClick={handleSaveMetadata}>Save Changes</Button>
          </DialogActions>
        </Dialog>

        {/* MODAL 2: Historical Telemetry Charts */}
        <Dialog open={chartOpen} onClose={() => setChartOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle fontWeight="bold" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              Performance Vectors
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 'normal' }}>
                {activeServer?.alias || activeServer?.hostname} • Historical Resource Utilization
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center" gap={2}>
              <ToggleButtonGroup
                value={timeRange}
                exclusive
                onChange={(e, newRange) => {
                  if (newRange) setTimeRange(newRange);
                }}
                size="small"
                sx={{ backgroundColor: '#fff', height: 32 }}
              >
                <ToggleButton value="1h" sx={{ px: 2, fontSize: '0.75rem', fontWeight: 'bold' }}>1H</ToggleButton>
                <ToggleButton value="24h" sx={{ px: 2, fontSize: '0.75rem', fontWeight: 'bold' }}>24H</ToggleButton>
                <ToggleButton value="30d" sx={{ px: 2, fontSize: '0.75rem', fontWeight: 'bold' }}>30D</ToggleButton>
                <ToggleButton value="1y" sx={{ px: 2, fontSize: '0.75rem', fontWeight: 'bold' }}>1Y</ToggleButton>
              </ToggleButtonGroup>
              <Chip label="Live Sync Active" color="success" size="small" variant="outlined" />
            </Box>

          </DialogTitle>
          
          <DialogContent dividers sx={{ backgroundColor: '#f8fafc', overflowX: 'hidden' }}>
            {telemetryData.length > 1 ? (
              <Box display="flex" flexDirection="column" gap={4} my={1} sx={{ width: '100%' }}>
                
                {/* CHART 1: Compute & Memory */}
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: '#fff', width: '100%' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="textSecondary" gutterBottom>COMPUTE & MEMORY OVER TIME</Typography>
                  <Box sx={{ width: '100%', minHeight: 280 }}>
                    <ResponsiveContainer width="99%" height={280}>
                      <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1976d2" stopOpacity={0.3}/><stop offset="95%" stopColor="#1976d2" stopOpacity={0}/></linearGradient>
                          <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2e7d32" stopOpacity={0.3}/><stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="recorded_at" tickFormatter={formatXAxis} tick={{ fill: '#94a3b8', fontSize: 12 }} minTickGap={40} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                        <Tooltip labelFormatter={formatTooltipDate} formatter={(value, name) => [`${value}%`, name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Area type="monotone" dataKey="ram_usage_pct" stroke="#2e7d32" fillOpacity={1} fill="url(#colorRam)" name="Memory Allocation" strokeWidth={2} isAnimationActive={false} />
                        <Area type="monotone" dataKey="cpu_usage_pct" stroke="#1976d2" fillOpacity={1} fill="url(#colorCpu)" name="CPU Core Load" strokeWidth={2} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </Card>

                {/* CHART 2: Storage & Swap */}
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: '#fff', width: '100%' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="textSecondary" gutterBottom>STORAGE DRIVE & SWAP UTILIZATION</Typography>
                  <Box sx={{ width: '100%', minHeight: 200 }}>
                    <ResponsiveContainer width="99%" height={200}>
                      <LineChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="recorded_at" tickFormatter={formatXAxis} tick={{ fill: '#94a3b8', fontSize: 12 }} minTickGap={40} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                        <Tooltip labelFormatter={formatTooltipDate} formatter={(value, name) => [`${value}%`, name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Line type="stepAfter" dataKey="storage_root_pct" stroke="#ed6c02" name="Root Disk Space" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="swap_usage_pct" stroke="#9c27b0" name="Swap Memory" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Card>

              </Box>
            ) : (
              <Box height={300} display="flex" alignItems="center" justifyContent="center">
                <Typography color="textSecondary" align="center">
                  {telemetryData.length === 1 
                    ? `Establishing baseline vectors... (1 data point received, waiting for the next ping)` 
                    : "No historical data available for this timeframe."}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, backgroundColor: '#fff' }}>
            <Button onClick={() => setChartOpen(false)} variant="contained" disableElevation>Close Diagnostics</Button>
          </DialogActions>
        </Dialog>

      </Container>
    </ThemeProvider>
  );
}