// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Test-only mock of a 6-decimal USD stablecoin. Faucet token for testnet/local use.
contract USDC is ERC20, Ownable {
    constructor(address _initialOwner) ERC20("USD Coin", "USDC") Ownable(_initialOwner) {
        _mint(_initialOwner, 1_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
