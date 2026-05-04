import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import 'hardhat-deploy';

/**
 * @title Deploy ObsidianVault
 * @dev Wires the verifier, Poseidon hasher, and token together. The tree depth here
 *      MUST match the circuit (`Withdraw(20)`), and the denomination is fixed.
 */
const LEVELS = 20;
const DENOMINATION = (100n * 10n ** 6n).toString(); // 100 USDC (6 decimals)

const deployObsidianVault: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get, log } = deployments;
    const { deployer } = await getNamedAccounts();

    const usdc = await get('USDC');
    const verifier = await get('Verifier');
    const poseidon = await get('Poseidon');

    const vault = await deploy('ObsidianVault', {
        from: deployer,
        args: [verifier.address, poseidon.address, usdc.address, DENOMINATION, LEVELS],
        log: true,
    });

    log(`ObsidianVault deployed at ${vault.address}`);
    log(`  verifier:     ${verifier.address}`);
    log(`  poseidon:     ${poseidon.address}`);
    log(`  token (USDC): ${usdc.address}`);
    log(`  denomination: ${DENOMINATION}`);
    log(`  levels:       ${LEVELS}`);
};

export default deployObsidianVault;
deployObsidianVault.tags = ['vault', 'main', 'core'];
deployObsidianVault.dependencies = ['usdc', 'poseidon', 'verifier'];
