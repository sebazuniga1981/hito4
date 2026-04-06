require("dotenv").config();

const secretKey = process.env.JWT_SECRET;

module.exports = secretKey;