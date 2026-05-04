import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import 'hardhat-deploy';

/**
 * @title Deploy the Groth16 withdraw verifier
 * @dev Generated from the circuit by `npm run build` in @obsidian/circuits.
 */
const deployVerifier: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    const verifier = await deploy('Verifier', {
        contract: 'Groth16Verifier',
        from: deployer,
        args: [],
        log: true,
    });

    log(`Withdraw verifier deployed at ${verifier.address}`);
};

export default deployVerifier;
deployVerifier.tags = ['verifier', 'main', 'core'];
