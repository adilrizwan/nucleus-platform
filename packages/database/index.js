const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Version 5 handles this perfectly

module.exports = { prisma };
