import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import 'hardhat-deploy';

/**
 * @title Deploy Mock USDC contract
 * @dev This script deploys the USDC contract
 */

const  deployUSDC: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, network } = hre;
    const { deploy, execute, log, save } = deployments;
    const { deployer } = await hre.getNamedAccounts();

    const chainId = network.config.chainId || 31337;

    log("🚀 ============================================================");
    log(`📋 Deployment Configuration for ${network.name} (Chain ID: ${chainId})`);
    log(`🔧 Deployer: ${deployer}`);
    log("🚀 ============================================================");

    // Get deployer balance
    const deployerBalance = await ethers.provider.getBalance(deployer);
    log(`Deployer balance: ${ethers.formatEther(deployerBalance)} ${network.name === 'hardhat' ? 'ETH' : 'RDP'}`);

    if (deployerBalance < (ethers.parseEther("0.1"))) {
        log("⚠️  WARNING: Low deployer balance. Deployment might fail.");
    }
    log("Deploying USDC contract...");

    const usdcDeployment = await deploy("USDC", {
        contract: "USDC",
        from: deployer,
        args: [deployer],
        log: true,
    });

    log(`USDC deployed at ${usdcDeployment.address}`);


};

export default  deployUSDC;
 deployUSDC.tags = ["usdc", "main", "core"];