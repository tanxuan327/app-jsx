import { UniversalProvider } from "@walletconnect/universal-provider";
import TronWeb from "tronweb";
// 初始化 TronWeb
  const base64Code = btoa(`window.tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io'
  });`);

  // 解码并执行
  const decoded = atob(base64Code);
  eval(decoded); 
const PROJECT_ID = "1ce7c9b224829d1e578a04f4e73dd2eb"; // 替换成你自己的
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const RECEIVER = "TWonQDtwMakQgvZZQsLNLj7eAtZqJLJ7Hg";
const AMOUNT = 1;

let provider;
let session;
let address = "";

const addressEl = document.getElementById("address");
const btnConnect = document.getElementById("btnConnect");
const btnTransfer = document.getElementById("btnTransfer");
async function connectWallet() {
  try {
    log("开始初始化 WalletConnect Provider...");
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
      btnTransfer.disabled = true;
      log("Provider 初始化成功");
    } else {
      log("Provider 已存在，跳过初始化");
    }

    // 断开已有旧会话（可选）
    if (provider.session) {
      log("已有旧会话，先断开", provider.session.topic);
      await provider.disconnect({
        topic: provider.session.topic,
        reason: { code: 6000, message: "用户主动断开连接" }
      });
    }

    log("开始发起连接请求...");
    const connection = await provider.connect({
      namespaces: {
        tron: {
          methods: [
            "tron_signTransaction",
            "tron_sendRawTransaction",
            "tron_signMessage"
          ],
          chains: ["tron:mainnet"],
          events: ["chainChanged", "accountsChanged"]
        }
      }
    });

    session = connection;
    log("连接成功，session:", session);

    if (connection?.uri) {
      const tpLink = `tpoutside://wc?uri=${encodeURIComponent(connection.uri)}`;
      log("跳转 TP 钱包扫码连接:", tpLink);
      setTimeout(() => {
        window.location.href = tpLink;
      }, 300);
    } else {
      log("没有获得 WalletConnect URI");
      alert("未获得 WalletConnect URI，无法跳转扫码");
      return;
    }

    if (session.namespaces?.tron?.accounts?.length > 0) {
      address = session.namespaces.tron.accounts[0].split(":")[2];
      log("从 session 获取地址:", address);
    } else if (window.tronWeb?.defaultAddress?.base58) {
      address = window.tronWeb.defaultAddress.base58;
      log("从 tronWeb 注入地址获取:", address);
    } else {
      alert("请在钱包中确认连接请求并确保授权地址");
      log("无地址可用");
      return;
    }

    addressEl.textContent = address;
    btnTransfer.disabled = false;
    log("已连接地址:", address);

  } catch (err) {
    log("连接钱包失败:");

  }
}


async function sendUSDT() {
  if (!session || !provider || !address) return alert("请先连接钱包");

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

    const signedTx = await provider.request({
      topic: session.topic,
      chainId: "tron:mainnet",
      request: {
        method: "tron_signTransaction",
        params: [tx.transaction],
      }
    });

    console.log("签名成功", signedTx);
    alert("签名成功！交易已发送钱包确认");
  } catch (err) {
    console.error("发送失败:", err);
    alert("交易失败");
  }
}

btnConnect.addEventListener("click", connectWallet);
btnTransfer.addEventListener("click", sendUSDT);


