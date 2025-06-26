import { UniversalProvider } from "@walletconnect/universal-provider";
import TronWeb from "tronweb";

const PROJECT_ID = "6e5e0ad7ffa9d4311442b0143abebc60"; // 替换成你的 projectId
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

    // 监听断开事件，清理状态
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

    // 如果已有会话，先断开
    if (provider.session) {
      console.log("已有旧会话，断开中...");
      await provider.disconnect({
        topic: provider.session.topic,
        reason: { code: 6000, message: "用户主动断开连接" }
      });
    }

    // 连接请求
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
    console.log("连接成功，session:", session);

    if (connection.uri) {
      // 跳转到 TP 钱包扫码
      const tpLink = `tpoutside://wc?uri=${encodeURIComponent(connection.uri)}`;
      console.log("唤起 TP 钱包扫码连接:", tpLink);
      setTimeout(() => {
        window.location.href = tpLink;
      }, 300);
    } else {
      alert("未获得 WalletConnect URI，无法扫码连接");
      return;
    }

    // 等待钱包授权连接（session 命名空间赋值后）
    if (session.namespaces?.tron?.accounts?.length > 0) {
      address = session.namespaces.tron.accounts[0].split(":")[2];
      addressEl.textContent = address;
      btnTransfer.disabled = false;
      console.log("钱包地址:", address);
    } else {
      alert("请在钱包中确认连接请求并授权地址");
    }

  } catch (err) {
    console.error("连接钱包失败:", err);
    alert("连接钱包失败");
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

    // 构造合约调用参数
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

    // 请求钱包签名交易
    const signedTx = await provider.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_signTransaction",
        params: [tx.transaction],
      }
    });

    console.log("签名成功:", signedTx);

    // 发送签名交易广播
    const broadcastResult = await provider.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_sendRawTransaction",
        params: [signedTx],
      }
    });

    console.log("交易广播结果:", broadcastResult);
    alert("交易已发送，等待区块确认");

  } catch (err) {
    console.error("交易失败:", err);
    alert("交易失败");
  }
}

// 事件绑定
btnConnect.addEventListener("click", connectWallet);
btnTransfer.addEventListener("click", sendUSDT);

// 初始状态禁用转账按钮
btnTransfer.disabled = true;
