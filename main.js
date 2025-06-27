import { UniversalProvider } from "@walletconnect/universal-provider";
import TronWeb from "tronweb";

const PROJECT_ID = "6e5e0ad7ffa9d4311442b0143abebc60"; // 替换为你的 WalletConnect 项目ID
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

    // 监听断开
    provider.on("session_delete", () => {
      address = "";
      addressEl.textContent = "";
      btnTransfer.disabled = true;
      session = null;
      console.log("Session 已断开");
    });

    // ✅ 监听 URI 事件：跳转到 TP 钱包
    provider.on("display_uri", (uri) => {
      console.log("WalletConnect URI:", uri);
      const tpLink = `tpoutside://wc?uri=${encodeURIComponent(uri)}`;
      window.location.href = tpLink;
    });
  }
}

async function connectWallet() {
  try {
    await initProvider();

    // 若已存在旧会话，先断开
    if (provider.session) {
      await provider.disconnect({
        topic: provider.session.topic,
        reason: { code: 6000, message: "用户主动断开连接" }
      });
    }

    // 发起连接请求
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

    session = connection;

    // 从 session 获取地址
    if (session.namespaces?.tron?.accounts?.length > 0) {
      address = session.namespaces.tron.accounts[0].split(":")[2];
      addressEl.textContent = address;
      btnTransfer.disabled = false;
      console.log("连接成功，钱包地址:", address);
    } else {
      alert("钱包未返回地址，请在钱包中授权连接");
    }

  } catch (err) {
    console.error("连接钱包失败:", err);
    alert("连接钱包失败，请查看控制台日志");
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

    // 签名交易
    const signedTx = await provider.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_signTransaction",
        params: [tx.transaction],
      }
    });

    console.log("签名成功:", signedTx);

    // 广播交易
    const broadcastResult = await provider.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_sendRawTransaction",
        params: [signedTx],
      }
    });

    console.log("广播成功:", broadcastResult);
    alert("交易已发送，等待区块确认");

  } catch (err) {
    console.error("交易失败:", err);
    alert("交易失败，请查看控制台");
  }
}

// 绑定按钮事件
btnConnect.addEventListener("click", connectWallet);
btnTransfer.addEventListener("click", sendUSDT);
btnTransfer.disabled = true;
