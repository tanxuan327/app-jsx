import { UniversalProvider } from "@walletconnect/universal-provider";
import TronWeb from "tronweb";

// ✅ 替换成你的 WalletConnect 项目 ID
const PROJECT_ID = "6e5e0ad7ffa9d4311442b0143abebc60";

// ✅ 转账目标地址和合约地址
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
  provider = new UniversalProvider({
    projectId: PROJECT_ID,
  });

  provider.on("display_uri", (uri) => {
    const tpLink = `tpoutside://wc?uri=${encodeURIComponent(uri)}`;
    console.log("跳转 TP:", tpLink);
    window.location.href = tpLink; // 直接跳转 TP 钱包
  });

  provider.on("session_event", (event) => {
    console.log("Session event:", event);
  });
}

async function connectWallet() {
  try {
    await initProvider();

    // 若有旧 session 先断开
    if (provider.session) {
      await provider.disconnect({
        topic: provider.session.topic,
        reason: { code: 6000, message: "手动断开" },
      });
    }

    // 连接到 WalletConnect
    const connection = await provider.connect({
      namespaces: {
        tron: {
          methods: [
            "tron_signTransaction",
            "tron_sendRawTransaction",
            "tron_signMessage",
          ],
          chains: ["tron:mainnet"],
          events: ["accountsChanged", "chainChanged"],
        },
      },
    });

    session = connection;

    // ✅ 等待 TP 钱包注入 tronWeb
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 增加等待时间

    if (window.tronWeb?.defaultAddress?.base58) {
      address = window.tronWeb.defaultAddress.base58;
      console.log("TP钱包地址:", address);
      addressEl.textContent = address;
      btnTransfer.disabled = false;
    } else if (session.namespaces.tron?.accounts?.length > 0) {
      address = session.namespaces.tron.accounts[0].split(":")[2];
      addressEl.textContent = address;
      btnTransfer.disabled = false;
    } else {
      alert("未检测到地址，请在 TP 钱包中授权");
    }
  } catch (err) {
    console.error("连接钱包失败:", err);
    alert("连接失败，请查看控制台");
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

    // ✅ 钱包签名
    const signedTx = await provider.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_signTransaction",
        params: [tx.transaction],
      }
    });

    console.log("签名成功:", signedTx);

    // ✅ 广播交易
    const broadcastResult = await provider.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_sendRawTransaction",
        params: [signedTx],
      }
    });

    console.log("广播成功:", broadcastResult);
    alert("交易已发送！");
  } catch (err) {
    console.error("交易失败:", err);
    alert("交易失败，请查看控制台");
  }
}

// ✅ 事件绑定
btnConnect.addEventListener("click", connectWallet);
btnTransfer.addEventListener("click", sendUSDT);
btnTransfer.disabled = true;
