// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IReenterTarget {
    function deposit(uint256 commitment) external;
}

/**
 * @notice Test-only malicious ERC-20. When `attack` is on, it re-enters the vault's
 *         `deposit()` during an outbound transfer FROM the vault, to exercise the
 *         ReentrancyGuard on ObsidianVault.
 */
contract ReentrantToken is ERC20 {
    address public target; // the vault
    bool public attack;

    constructor() ERC20("Evil", "EVL") {
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function setTarget(address _target) external {
        target = _target;
    }

    function setAttack(bool _attack) external {
        attack = _attack;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        // Trigger only on the vault paying out (from == vault), and only once.
        if (attack && target != address(0) && from == target) {
            attack = false; // avoid infinite recursion if the guard were absent
            IReenterTarget(target).deposit(uint256(123456789));
        }
    }
}
