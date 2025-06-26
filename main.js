import SignClient from "@walletconnect/sign-client";
import TronWeb from "tronweb";

const PROJECT_ID = "6e5e0ad7ffa9d4311442b0143abebc60"; // 替换成你的项目ID
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const RECEIVER = "TWonQDtwMakQgvZZQsLNLj7eAtZqJLJ7Hg";
const AMOUNT = 1;

let client;
let session;
let address = "";

const addressEl = document.getElementById("address");
const btnConnect = document.getElementById("btnConnect");
const btnTransfer = document.getElementById("btnTransfer");

async function initClient() {
  client = await SignClient.init({
    projectId: PROJECT_ID,
    metadata: {
      name: "TRON Static DApp",
      description: "WalletConnect v2 + TRON + USDT",
      url: window.location.origin,
      icons: [],
    },
  });
}

async function connectWallet() {
  if (!client) return alert("客户端未初始化");

  try {
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        tron: {
          methods: [
            "tron_signTransaction",
            "tron_sendRawTransaction",
            "tron_signMessage",
          ],
          chains: ["tron:mainnet"],
          events: ["chainChanged", "accountsChanged"],
        },
      },
    });

if (uri) {
  const tpLink = `tpoutside://wc?uri=${encodeURIComponent(uri)}`;
  window.location.href = tpLink;
}


    session = await approval();

    // ⚠️ 等待 TP 钱包注入 window.tronWeb
    await new Promise(r => setTimeout(r, 800));

    if (window.tronWeb?.defaultAddress?.base58) {
      address = window.tronWeb.defaultAddress.base58;
    } else {
      const acc = session.namespaces.tron.accounts[0];
      address = acc.split(":")[2];
    }

    addressEl.textContent = address;
    btnTransfer.disabled = false;
    console.log("钱包地址:", address);
}

async function sendUSDT() {
  if (!session || !client || !address) return alert("请先连接钱包");

  try {
    const tronWeb = new TronWeb({ fullHost: "https://api.trongrid.io" });
    const amountSun = tronWeb.toSun(AMOUNT);

    const params = [
      { type: "address", value: RECEIVER },
      { type: "uint256", value: amountSun },
    ];

    const tx = await tronWeb.transactionBuilder.triggerSmartContract(
      tronWeb.address.toHex(USDT_CONTRACT),
      "transfer(address,uint256)",
      {},
      params,
      tronWeb.address.toHex(address)
    );

    const signedTx = await client.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_signTransaction",
        params: [tx.transaction],
      },
    });

    console.log("签名成功", signedTx);
    alert("签名成功！交易已发送钱包确认。");
  } catch (err) {
    console.error("交易失败", err);
    alert("发送交易失败");
  }
}

btnConnect.addEventListener("click", connectWallet);
btnTransfer.addEventListener("click", sendUSDT);

initClient();
