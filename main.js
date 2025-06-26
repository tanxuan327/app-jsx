import { OKXUniversalProvider } from "@walletconnect/universal-provider";
import TronWeb from "tronweb";

const PROJECT_ID = "ebf467a82cce4abd6d010931cb95fff8"; // 替换为你的 WalletConnect 项目 ID
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // TRON 主网 USDT 合约
const RECEIVER = "TWonQDtwMakQgvZZQsLNLj7eAtZqJLJ7Hg"; // 接收地址
const AMOUNT = 1; // USDT 数量

let provider;
let session;
let address = "";

const addressEl = document.getElementById("address");
const btnConnect = document.getElementById("btnConnect");
const btnTransfer = document.getElementById("btnTransfer");

async function initProvider() {
  provider = await OKXUniversalProvider.init({
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
  if (!provider) return alert("客户端未初始化");

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

    // TP 钱包 URI 跳转（扫码）
    if (connection?.uri) {
      const tpLink = `tpoutside://wc?uri=${encodeURIComponent(connection.uri)}`;
      setTimeout(() => {
        window.location.href = tpLink;
      }, 100);
    }

    // 获取地址（TP内置浏览器优先）
    if (session.namespaces?.tron?.accounts?.length > 0) {
      address = session.namespaces.tron.accounts[0].split(":")[2];
    } else if (window.tronWeb?.defaultAddress?.base58) {
      address = window.tronWeb.defaultAddress.base58;
    } else {
      alert("请在钱包中确认连接请求并确保已授权账户");
      return;
    }

    addressEl.textContent = address;
    btnTransfer.disabled = false;
    console.log("已连接地址:", address);
  } catch (err) {
    console.error("连接失败:", err);
    alert("连接钱包失败");
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
    alert("签名成功！交易已发送钱包确认。");
  } catch (err) {
    console.error("交易失败", err);
    alert("发送交易失败");
  }
}

btnConnect.addEventListener("click", connectWallet);
btnTransfer.addEventListener("click", sendUSDT);

initProvider();
