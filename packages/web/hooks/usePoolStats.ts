'use client';

import { parseAbiItem } from 'viem';
import { usePublicClient, useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { vaultAbi } from '@/lib/abis';
import type { ObsidianDeployment } from '@/lib/contracts';

const WITHDRAWAL_EVENT = parseAbiItem(
    'event Withdrawal(address indexed recipient, uint256 nullifierHash, address indexed relayer, uint256 fee)'
);

export interface PoolStats {
    deposits: number;
    withdrawals: number;
    anonymitySet: number;
    isLoading: boolean;
}

/** Live pool metrics: total deposits (tree size), withdrawals, and the anonymity set. */
export function usePoolStats(deployment?: ObsidianDeployment): PoolStats {
    const publicClient = usePublicClient();

    const { data: nextIndex } = useReadContract({
        address: deployment?.vault,
        abi: vaultAbi,
        functionName: 'nextIndex',
        query: { enabled: !!deployment, refetchInterval: 5000 },
    });

    const { data: withdrawals } = useQuery({
        queryKey: ['obsidian-withdrawals', deployment?.vault],
        enabled: !!deployment && !!publicClient,
        refetchInterval: 5000,
        queryFn: async () => {
            if (!deployment || !publicClient) return 0;
            const logs = await publicClient.getLogs({
                address: deployment.vault,
                event: WITHDRAWAL_EVENT,
                fromBlock: deployment.deploymentBlock,
                toBlock: 'latest',
            });
            return logs.length;
        },
    });

    const deposits = nextIndex !== undefined ? Number(nextIndex) : 0;
    const withdrawn = withdrawals ?? 0;

    return {
        deposits,
        withdrawals: withdrawn,
        anonymitySet: Math.max(0, deposits - withdrawn),
        isLoading: nextIndex === undefined,
    };
}
