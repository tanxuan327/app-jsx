import { UniversalProvider } from "@walletconnect/universal-provider";
import TronWeb from "tronweb";

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

async function initProvider() {
  provider = await UniversalProvider.init({
    projectId: PROJECT_ID,
    metadata: {
      name: "TRON DApp",
      description: "WalletConnect v2 + TRON",
      url: window.location.origin,
      icons: [],
    },
  });
}

async function connectWallet() {
  if (!provider) return alert("Provider 未初始化");

  try {
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

    // 跳转 TP 钱包扫码连接（用于 TP 钱包外部浏览器）
    if (connection?.uri) {
      const tpLink = `tpoutside://wc?uri=${encodeURIComponent(connection.uri)}`;
      window.location.href = tpLink;
    }

    // 尝试获取地址（优先 session 返回）
    if (session.namespaces?.tron?.accounts?.length > 0) {
      address = session.namespaces.tron.accounts[0].split(":")[2];
    } else if (window.tronWeb?.defaultAddress?.base58) {
      address = window.tronWeb.defaultAddress.base58;
    } else {
      alert("请在钱包中确认连接请求并确保授权地址");
      return;
    }

    addressEl.textContent = address;
    btnTransfer.disabled = false;
    console.log("已连接地址:", address);
  } catch (err) {
    console.error("连接钱包失败:", err);
    alert("连接失败");
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

initProvider();
