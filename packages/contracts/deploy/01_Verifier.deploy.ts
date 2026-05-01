import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import 'hardhat-deploy';

/**
 * @title Deploy zk proof verifier contract
 * @dev This script deploys the Verifier contract
 */

const deployVerifier: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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
    log("Deploying Verifier contract...");

    const verifierDeployment = await deploy("Groth-16-ZK-Verifier", {
        contract: "Verifier",
        from: deployer,
        args: [],
        log: true,
    });

    log(`ZK-Verifier deployed at ${verifierDeployment.address}`);


};

export default deployVerifier;
deployVerifier.tags = ["verifier", "main", "core"];