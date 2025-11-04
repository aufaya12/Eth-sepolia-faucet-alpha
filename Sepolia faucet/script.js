const claimBtn = document.getElementById("claimBtn");
const addressInput = document.getElementById("address");
const message = document.getElementById("message");
const txHashDiv = document.getElementById("txHash");
const txLink = document.getElementById("txLink");

claimBtn.addEventListener("click", async () => {
  const address = addressInput.value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    showMessage("⚠️ Alamat Ethereum tidak valid!", "error");
    return;
  }

  claimBtn.disabled = true;
  showMessage("⏳ Mengirim 0.0001 ETH Sepolia...", "info");

  try {
    const res = await fetch("/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });

    const data = await res.json();

    if (res.ok) {
      showMessage("✅ Berhasil! ETH telah dikirim.", "success");
      txLink.href = `https://sepolia.etherscan.io/tx/${data.txHash}`;
      txHashDiv.classList.remove("hidden");
    } else {
      showMessage(`❌ ${data.error}`, "error");
    }
  } catch (err) {
    showMessage("❌ Gagal terhubung ke server.", "error");
  } finally {
    claimBtn.disabled = false;
  }
});

function showMessage(text, type) {
  message.textContent = text;
  message.style.color = type === "success" ? "#a8e6cf" : type === "error" ? "#ff6b6b" : "#ffd93d";
}
