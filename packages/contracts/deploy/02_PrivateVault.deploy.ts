import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import 'hardhat-deploy';

/**
 * @title Deploy private USDC-vault contract
 * @dev This script deploys the privateVault contract
 */

const  deployPrivateVault: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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
    log("Deploying Private Vault contract...");

    const usdc = await deployments.get("USDC"); 
    const zkVerifier = await deployments.get("Groth-16-ZK-Verifier");

    const privateVaultrDeployment = await deploy("Private-USDC-Vault", {
        contract: "PrivateVault",
        from: deployer,
        args: [zkVerifier.address, usdc.address],
        log: true,
    });

    log(`USDC-Private-Vault deployed at ${privateVaultrDeployment.address}`);


};

export default  deployPrivateVault;
 deployPrivateVault.tags = ["usdc_pvt_vault", "main", "core"];