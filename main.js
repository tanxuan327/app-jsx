import { UniversalProvider } from "@walletconnect/universal-provider";
import TronWeb from "tronweb";

const PROJECT_ID = "6e5e0ad7ffa9d4311442b0143abebc60"; // 替换成你自己的 projectId
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const RECEIVER = "TWonQDtwMakQgvZZQsLNLj7eAtZqJLJ7Hg";
const AMOUNT = 1;

let provider;
let session;
let address = "";

const addressEl = document.getElementById("address");
const btnConnect = document.getElementById("btnConnect");
const btnTransfer = document.getElementById("btnTransfer");

async function initProvider() {
  if (!provider) {
    provider = await UniversalProvider.init({
      projectId: PROJECT_ID,
      metadata: {
        name: "TRON DApp",
        description: "WalletConnect v2 + TRON",
        url: window.location.origin,
        icons: [],
      },
    });

    provider.on("session_delete", () => {
      address = "";
      addressEl.textContent = "";
      btnTransfer.disabled = true;
      session = null;
      console.log("Session 已断开");
    });
  }
}

async function connectWallet() {
  try {
    await initProvider();

    // 断开已有旧会话
    if (provider.session) {
      await provider.disconnect({
        topic: provider.session.topic,
        reason: { code: 6000, message: "用户主动断开连接" }
      });
    }

    const connection = await provider.connect({
      namespaces: {
        tron: {
          methods: [
            "tron_signTransaction",
            "tron_sendRawTransaction",
            "tron_signMessage"
          ],
          chains: ["tron:mainnet"],
          events: ["accountsChanged", "chainChanged"]
        }
      }
    });

    // 🚀 跳转唤起 TP 钱包
    if (connection.uri) {
      const tpLink = `tpoutside://wc?uri=${encodeURIComponent(connection.uri)}`;
      window.location.href = tpLink;
    } else {
      alert("未获得 WalletConnect URI");
      return;
    }

    // ✅ 等待用户在钱包中确认连接
    session = await connection.approval();
    console.log("连接成功，session:", session);

    if (session.namespaces?.tron?.accounts?.length > 0) {
      address = session.namespaces.tron.accounts[0].split(":")[2];
      addressEl.textContent = address;
      btnTransfer.disabled = false;
      console.log("钱包地址:", address);
    } else {
      alert("钱包未授权地址");
    }

  } catch (err) {
    console.error("连接钱包失败:", err);
    alert("连接钱包失败，请查看控制台");
  }
}

async function sendUSDT() {
  if (!session || !provider || !address) {
    alert("请先连接钱包");
    return;
  }

  try {
    const tronWeb = new TronWeb({ fullHost: "https://api.trongrid.io" });
    const amountSun = tronWeb.toSun(AMOUNT);

    const params = [
      { type: "address", value: RECEIVER },
      { type: "uint256", value: amountSun }
    ];

    const tx = await tronWeb.transactionBuilder.triggerSmartContract(
      tronWeb.address.toHex(USDT_CONTRACT),
      "transfer(address,uint256)",
      {},
      params,
      tronWeb.address.toHex(address)
    );

    // ✍️ 钱包签名
    const signedTx = await provider.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_signTransaction",
        params: [tx.transaction],
      }
    });

    console.log("签名成功:", signedTx);

    // 🚀 广播交易
    const broadcastResult = await provider.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_sendRawTransaction",
        params: [signedTx],
      }
    });

    console.log("交易广播结果:", broadcastResult);
    alert("交易已发送，等待确认");

  } catch (err) {
    console.error("交易失败:", err);
    alert("交易失败，请查看控制台");
  }
}

// 绑定按钮事件
btnConnect.addEventListener("click", connectWallet);
btnTransfer.addEventListener("click", sendUSDT);
btnTransfer.disabled = true;
