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

    // ✅ 注册 TRON 网络的 provider 实现
    await provider.setProvider("tron:mainnet", {
      request: async ({ method, params }) => {
        const tronWeb = new TronWeb({ fullHost: "https://api.trongrid.io" });

        switch (method) {
          case "tron_signTransaction":
            return params[0]; // 钱包处理签名
          case "tron_sendRawTransaction":
            return await tronWeb.trx.sendRawTransaction(params[0]);
          case "tron_signMessage":
            return await tronWeb.trx.sign(params[0]);
          default:
            throw new Error(`不支持的方法: ${method}`);
        }
      },
    });

    // ✅ 监听跳转链接
    provider.on("display_uri", (uri) => {
      const tpLink = `tpoutside://wc?uri=${encodeURIComponent(uri)}`;
      console.log("跳转 TP 钱包扫码链接:", tpLink);
      window.location.href = tpLink;
    });

    // ✅ 会话断开处理
    provider.on("session_delete", () => {
      address = "";
      addressEl.textContent = "";
      btnTransfer.disabled = true;
      session = null;
      console.log("会话已断开");
    });
  }
}

async function connectWallet() {
  try {
    await initProvider();

    // ✅ 如果已有旧会话，先断开
    if (provider.session) {
      await provider.disconnect({
        topic: provider.session.topic,
        reason: { code: 6000, message: "主动断开" }
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

    session = connection;

    // ✅ 获取地址
    if (session.namespaces?.tron?.accounts?.length > 0) {
      address = session.namespaces.tron.accounts[0].split(":")[2];
      addressEl.textContent = address;
      btnTransfer.disabled = false;
      console.log("钱包地址:", address);
    } else {
      alert("钱包未返回地址，请检查钱包授权");
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
btnConnect.addEvent
