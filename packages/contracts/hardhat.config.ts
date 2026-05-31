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

// Testnet RPC URLs and Explorer Keys
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_NODE_KEY}`;
const ARBITRUM_SEPOLIA_RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_NODE_KEY}`;
const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_NODE_KEY}`;

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";
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


if (process.env.ENABLE_FORK_TESTS === 'true') {
  console.log("FORK MODE ENABLED - Testing against Sepolia");
  console.log(`Fork URL: ${SEPOLIA_RPC_URL}`);
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
        url: SEPOLIA_RPC_URL,
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

    sepolia: {
      accounts: [OWNER_PVT_KEY],
      url: SEPOLIA_RPC_URL,
      live: true,
      gas: "auto",
      saveDeployments: true,
      gasMultiplier: 1.5,
      chainId: 11155111,
    },
    arbSepolia: {
      accounts: [OWNER_PVT_KEY],
      url: ARBITRUM_SEPOLIA_RPC_URL,
      live: true,
      gas: "auto",
      saveDeployments: true,
      gasMultiplier: 1.5,
      chainId: 421614,
    },
    baseSepolia: {
      accounts: [OWNER_PVT_KEY],
      url: BASE_SEPOLIA_RPC_URL,
      live: true,
      gas: "auto",
      saveDeployments: true,
      gasMultiplier: 1.5,
      chainId: 84532,
    },
  },
  etherscan: {
    enabled: true, // Disable automatic verification for all networks
    apiKey: {
      avaxFuji: "avascan",
      avalanche: "avascan",
      sepolia: ETHERSCAN_API_KEY,
      arbitrumSepolia: ARBISCAN_API_KEY,
      arbSepolia: ARBISCAN_API_KEY,
      arvSepolia: ARBISCAN_API_KEY,
      baseSepolia: BASESCAN_API_KEY,
    },
    customChains: [
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
      },
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io"
        }
      },
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "arbSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "arvSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
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
