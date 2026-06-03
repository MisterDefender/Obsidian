import Link from 'next/link';

// TODO: point these at the public repo when published.
const REPO_URL = '#';

export function Footer() {
    return (
        <footer className="relative border-t border-ash/40 px-6 py-12 md:px-10">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
                <div className="max-w-sm">
                    <span className="font-display text-sm font-bold tracking-[0.35em] text-bone">
                        OBSIDIAN
                    </span>
                    <p className="mt-3 text-sm leading-relaxed text-smoke">
                        A zero-knowledge shielded vault. Deposit, then withdraw to a fresh address
                        with no on-chain link between the two.
                    </p>
                    <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 px-3 py-1 font-mono text-[11px] text-amber-400/90">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Research · testnet only · unaudited
                    </p>
                </div>

                <div className="flex gap-14">
                    <div className="flex flex-col gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-smoke/60">
                            App
                        </span>
                        <Link href="/vault" className="text-sm text-bone/80 hover:text-ember">
                            Vault
                        </Link>
                        <a href="#how" className="text-sm text-bone/80 hover:text-ember">
                            How it works
                        </a>
                    </div>
                    <div className="flex flex-col gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-smoke/60">
                            Project
                        </span>
                        <a href={REPO_URL} className="text-sm text-bone/80 hover:text-ember">
                            Source
                        </a>
                        <a href={REPO_URL} className="text-sm text-bone/80 hover:text-ember">
                            Threat model
                        </a>
                    </div>
                </div>
            </div>

            <div className="mx-auto mt-10 w-full max-w-5xl border-t border-ash/30 pt-6">
                <p className="font-mono text-[11px] text-smoke/60">
                    Do not use with real funds. Obsidian is an educational study of zero-knowledge
                    privacy engineering.
                </p>
            </div>
        </footer>
    );
}
