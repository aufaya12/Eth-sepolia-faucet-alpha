require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const { Redis } = require("@upstash/redis"); // ← GANTI INI
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("."));

// === ENV VARIABLES (PAKAI REST) ===
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error("Missing Upstash Redis REST credentials!");
  process.exit(1);
}

// === REDIS CLIENT (REST API) ===
const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

// Konfigurasi Faucet
const FAUCET_ADDRESS = "0xdead007bB31cB02cF1Bd52ea3fC6B3cac0d57767";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = "https://rpc.sepolia.org";
const AMOUNT = ethers.parseEther("0.0001");
const COOLDOWN = 24 * 60 * 60; // 24 jam

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// === KLAIM ENDPOINT ===
app.post("/claim", async (req, res) => {
  const { address } = req.body;

  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: "Alamat tidak valid" });
  }

  const key = `faucet:${address.toLowerCase()}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const lastClaim = await redis.get(key);
    if (lastClaim && now - parseInt(lastClaim) < COOLDOWN) {
      const remaining = COOLDOWN - (now - parseInt(lastClaim));
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      return res.status(429).json({
        error: `Tunggu ${hours} jam ${minutes} menit lagi untuk klaim ulang.`
      });
    }

    const balance = await provider.getBalance(FAUCET_ADDRESS);
    if (balance < AMOUNT) {
      return res.status(500).json({ error: "Faucet kehabisan ETH Sepolia!" });
    }

    const tx = await wallet.sendTransaction({
      to: address,
      value: AMOUNT
    });

    // Simpan waktu klaim (TTL 24 jam)
    await redis.set(key, now, { ex: COOLDOWN });

    res.json({ txHash: tx.hash });
  } catch (err) {
    console.error("Claim error:", err);
    res.status(500).json({ error: "Gagal mengirim transaksi." });
  }
});

module.exports = app;
