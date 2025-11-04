require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const redis = require("redis");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("."));

// Konfigurasi
const PORT = process.env.PORT || 3000;
const FAUCET_ADDRESS = "0xdead007bB31cB02cF1Bd52ea3fC6B3cac0d57767";
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Simpan di .env
const RPC_URL = "https://rpc.sepolia.org";
const AMOUNT = ethers.parseEther("0.0001"); // 0.0001 ETH
const COOLDOWN = 24 * 60 * 60; // 24 jam dalam detik

// Provider & Wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Redis (gunakan Upstash atau Redis lokal)
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});
redisClient.connect().catch(console.error);

// Klaim endpoint
app.post("/claim", async (req, res) => {
  const { address } = req.body;

  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: "Alamat tidak valid" });
  }

  const key = `faucet:${address.toLowerCase()}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const lastClaim = await redisClient.get(key);
    if (lastClaim && now - parseInt(lastClaim) < COOLDOWN) {
      const remaining = COOLDOWN - (now - parseInt(lastClaim));
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      return res.status(429).json({
        error: `Tunggu ${hours} jam ${minutes} menit lagi untuk klaim ulang.`
      });
    }

    // Cek saldo faucet
    const balance = await provider.getBalance(FAUCET_ADDRESS);
    if (balance < AMOUNT) {
      return res.status(500).json({ error: "Faucet kehabisan ETH Sepolia!" });
    }

    // Kirim transaksi
    const tx = await wallet.sendTransaction({
      to: address,
      value: AMOUNT
    });

    await redisClient.set(key, now, { EX: COOLDOWN });

    res.json({ txHash: tx.hash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengirim transaksi." });
  }
});

app.listen(PORT, () => {
  console.log(`Faucet berjalan di http://localhost:${PORT}`);
});
