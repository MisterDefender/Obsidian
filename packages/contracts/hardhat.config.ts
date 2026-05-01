import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-deploy";
import 'solidity-coverage'

// import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";
import * as path from "path";

// Load the monorepo-root .env (this package lives in packages/contracts).
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Provide default values for environment variables
const OWNER_PVT_KEY = process.env.OWNER_PVT_KEY || "0x" + "11".repeat(32); // Default private key (if env not set)
const ALICE = process.env.ALICE || "0x" + "11".repeat(32); // Default private key (if env not set)
const BOB = process.env.BOB || "0x" + "11".repeat(32); // Default private key (if env not set)
const ALCHEMY_NODE_KEY = process.env.ALCHEMY_NODE_KEY || "your_default_alchemy_key";
const MONSOON_API_KEY = process.env.MONSOON_API_KEY || "empty"; // Add Monsoon API key (if required)
const MONSOON_ALPHA_NODE_URL = process.env.MONSOON_ALPHA_NODE_URL || "your_default_node_URL"
// Warn if mock values are being used
if (!process.env.OWNER_PVT_KEY) {
  console.warn("⚠️ WARNING: Using a mock private key. Provide a valid `OWNER_PVT_KEY` in your .env file for actual mainnet/testnet interactions.");
}
if (!process.env.ALICE) {
  console.warn("⚠️ WARNING: Using a mock private key. Provide a valid `ALICE` in your .env file for actual mainnet/testnet interactions.");
}
if (!process.env.BOB) {
  console.warn("⚠️ WARNING: Using a mock private key. Provide a valid `BOB` in your .env file for actual mainnet/testnet interactions.");
}
if (!process.env.ALCHEMY_NODE_KEY) {
  console.warn("⚠️ WARNING: Using a mock Alchemy node key. Provide a valid `ALCHEMY_NODE_KEY` in your .env file for actual mainnet/testnet interactions.");
}
if (!process.env.MONSOON_ALPHA_NODE_URL) {
  console.warn("⚠️ WARNING: Using a mock Monsoon node URL. Provide a valid `MONSOON_ALPHA_NODE_URL` in your .env file for actual mainnet/testnet interactions.");
}


if (process.env.ENABLE_FORK_TESTS === 'true') {
  console.log("FORK MODE ENABLED - Testing against monsoon-testnet");
  console.log(`Fork URL: ${MONSOON_ALPHA_NODE_URL}`);
} else {
  console.log("LOCAL MODE - Testing on local hardhat network");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: { default: 0 },
    identityHolder: 1,
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
      forking: process.env.ENABLE_FORK_TESTS === 'true' ? {
        url: MONSOON_ALPHA_NODE_URL,
        blockNumber: 1932, // use latest block number
        enabled: true,
      } : undefined,
    },
    avaxFuji: {
      accounts: [OWNER_PVT_KEY],
      url: `https://avax-fuji.g.alchemy.com/v2/${ALCHEMY_NODE_KEY}`,
      live: true,
      gas: "auto",
      saveDeployments: true,
      gasMultiplier: 2,
    },
    avalanche: {
      accounts: [OWNER_PVT_KEY],
      url: `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_NODE_KEY}`,
      live: true,
      gas: "auto",
      saveDeployments: true,
      gasMultiplier: 2,
    },
    "monsoonAlpha": {
      accounts: [OWNER_PVT_KEY, ALICE, BOB],
      url: `https:/${MONSOON_ALPHA_NODE_URL}`,
      live: true,
      gas: "auto",
      saveDeployments: true,
      gasMultiplier: 2,
      chainId: 100611,
    },
  },
  etherscan: {
    enabled: true, // Disable automatic verification for all networks
    apiKey: {
      "monsoonAlpha": MONSOON_API_KEY,
      avaxFuji: "avascan",
      avalanche: "avascan"
    },
    customChains: [
      {
        network: "monsoonAlpha",
        chainId: 100611,
        urls: {
          apiURL: "https://scout.alpha.monsoon.rainfall.one/api",
          browserURL: "https://scout.alpha.monsoon.rainfall.one"
        }
      },
      {
        network: "avaxFuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api.avascan.info/v2/network/testnet/evm/43113/etherscan",
          browserURL: "https://testnet.avascan.info/blockchain/C-Chain"
        }
      },
      {
        network: "avalanche",
        chainId: 43114,
        urls: {
          apiURL: "https://api.avascan.info/v2/network/mainnet/evm/43114/etherscan",
          browserURL: "https://testnet.avascan.info/blockchain/C-Chain"
        }
      }
    ],
  },
  sourcify: {
    enabled: false,
  },
  gasReporter: {
    enabled: false  // Disable gas reporting
  },
};

export default config;
