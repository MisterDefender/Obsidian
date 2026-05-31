'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';

interface CustomConnectButtonProps {
    large?: boolean;
}

export function CustomConnectButton({ large = false }: CustomConnectButtonProps) {
    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
            }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus || authenticationStatus === 'authenticated');

                return (
                    <div
                        {...(!ready && {
                            'aria-hidden': true,
                            style: {
                                opacity: 0,
                                pointerEvents: 'none',
                                userSelect: 'none',
                            },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        type="button"
                                        className={
                                            large
                                                ? 'rounded-xl bg-gradient-to-r from-ember to-ember-glow px-6 py-3 font-display text-sm font-semibold text-void shadow-[0_0_30px_-5px_var(--color-ember)] transition-transform hover:scale-[1.02] cursor-pointer'
                                                : 'rounded-xl bg-gradient-to-r from-ember to-ember-glow px-4 py-2 font-display text-xs font-semibold text-void shadow-[0_0_20px_-5px_var(--color-ember)] transition-transform hover:scale-[1.02] cursor-pointer'
                                        }
                                    >
                                        Connect Wallet
                                    </button>
                                );
                            }

                            if (chain.unsupported) {
                                return (
                                    <button
                                        onClick={openChainModal}
                                        type="button"
                                        className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2 font-display text-xs font-semibold text-red-400 hover:bg-red-500/20 cursor-pointer"
                                    >
                                        Wrong Network
                                    </button>
                                );
                            }

                            return (
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={openChainModal}
                                        type="button"
                                        className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 font-display text-xs font-semibold text-bone hover:border-ember/40 transition-colors cursor-pointer"
                                    >
                                        {chain.hasIcon && chain.iconUrl && (
                                            <span
                                                className="relative shrink-0 overflow-hidden rounded-full"
                                                style={{
                                                    background: chain.iconBackground,
                                                    width: 14,
                                                    height: 14,
                                                }}
                                            >
                                                <Image
                                                    alt={chain.name ?? 'Chain icon'}
                                                    src={chain.iconUrl}
                                                    width={14}
                                                    height={14}
                                                    className="h-full w-full object-contain"
                                                />
                                            </span>
                                        )}
                                        {chain.name}
                                    </button>

                                    <button
                                        onClick={openAccountModal}
                                        type="button"
                                        className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-xs text-bone hover:border-ember/40 transition-colors cursor-pointer"
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_1px_rgba(52,211,153,0.5)]" />
                                        {account.displayName}
                                        {account.displayBalance && (
                                            <span className="text-smoke/80 font-normal">
                                                ({account.displayBalance})
                                            </span>
                                        )}
                                    </button>
                                </div>
                              );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
}
