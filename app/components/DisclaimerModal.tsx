"use client";
export function DisclaimerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#0b132b", border: "1px solid rgba(252,163,17,0.3)", borderRadius: 12, padding: "2rem", maxWidth: 580, width: "90%", maxHeight: "85vh", overflowY: "auto" }}>
        <h2 style={{ color: "var(--accent)", fontWeight: 800, marginBottom: "0.5rem", fontSize: 20 }}>⚠️ DISCLAIMER & TERMS OF PARTICIPATION</h2>
        <p style={{ color: "#aaa", fontSize: ".85rem", marginBottom: "1rem" }}><strong>Last updated: June 2026</strong></p>
        <p style={{ color: "#aaa", fontSize: ".85rem", marginBottom: "1rem" }}>By accessing this website and participating in THEO Pools, you acknowledge and agree to the following terms. Please read carefully before proceeding.</p>

        <p style={{ color: "var(--accent)", fontSize: ".8rem", fontWeight: 700, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>1. Financial Risk</p>
        <ol style={{ color: "#aaa", fontSize: ".85rem", lineHeight: 1.8, paddingLeft: "1.2rem", marginBottom: "1rem" }}>
          <li><strong>No Financial Advice.</strong> Nothing on this website constitutes financial, investment, legal, or tax advice of any kind.</li>
          <li><strong>High Risk.</strong> Cryptocurrency and DeFi protocols are highly volatile and speculative. You may lose some or all funds staked.</li>
          <li><strong>No Guarantees.</strong> No guarantees are made regarding token value, liquidity, returns, yield, or market performance.</li>
          <li><strong>Not a Security.</strong> THEO tokens are not securities, bonds, or investment contracts. They are utility tokens used within the THEO Pools protocol.</li>
          <li><strong>No Investment Relationship.</strong> Participation does not create any investor-issuer relationship between you and the protocol creators.</li>
        </ol>

        <p style={{ color: "var(--accent)", fontSize: ".8rem", fontWeight: 700, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>2. Game Mechanics & Protocol Rules</p>
        <ol style={{ color: "#aaa", fontSize: ".85rem", lineHeight: 1.8, paddingLeft: "1.2rem", marginBottom: "1rem" }}>
          <li><strong>Conviction Game.</strong> THEO Pools is a conviction staking game, not a savings product or yield protocol. Early exits result in permanent penalties with no exceptions.</li>
          <li><strong>Claim Window.</strong> You must claim your rewards within the designated claim window. Unclaimed rewards roll over to the next pool permanently and irrecoverably.</li>
          <li><strong>Fill Window.</strong> If a pool does not reach the required number of players before the fill deadline, it becomes stalled. You must withdraw your stake manually — it is not returned automatically.</li>
          <li><strong>On-Chain Finality.</strong> All transactions are final once confirmed on-chain. There are no chargebacks, reversals, or refunds under any circumstances.</li>
          <li><strong>No Admin Override.</strong> The protocol is fully permissionless. No administrator, developer, or third party can pause, modify, or reverse any transaction or pool outcome.</li>
        </ol>

        <p style={{ color: "var(--accent)", fontSize: ".8rem", fontWeight: 700, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>3. Technical Risk</p>
        <ol style={{ color: "#aaa", fontSize: ".85rem", lineHeight: 1.8, paddingLeft: "1.2rem", marginBottom: "1rem" }}>
          <li><strong>Smart Contract Risk.</strong> Smart contracts may contain bugs, vulnerabilities, or unforeseen edge cases. Participation is entirely at your own risk.</li>
          <li><strong>Blockchain Risk.</strong> Network outages, congestion, forks, or validator issues on X1 Network may affect your ability to transact. The protocol is not responsible for blockchain-level failures.</li>
          <li><strong>Wallet Risk.</strong> You are solely responsible for the security of your private keys and wallet. Lost keys cannot be recovered. Compromised wallets cannot be protected.</li>
          <li><strong>Frontend Risk.</strong> This website is a frontend interface to the on-chain protocol. The frontend may experience downtime. The smart contract remains accessible directly even if this website is unavailable.</li>
          <li><strong>Oracle Risk.</strong> Where applicable, on-chain randomness is sourced from the Geiger Entropy Oracle. Results are final and verifiable on-chain.</li>
        </ol>

        <p style={{ color: "var(--accent)", fontSize: ".8rem", fontWeight: 700, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>4. Legal & Regulatory</p>
        <ol style={{ color: "#aaa", fontSize: ".85rem", lineHeight: 1.8, paddingLeft: "1.2rem", marginBottom: "1rem" }}>
          <li><strong>Regulatory Compliance.</strong> You are solely responsible for ensuring your participation complies with all applicable laws and regulations in your jurisdiction.</li>
          <li><strong>Restricted Jurisdictions.</strong> This protocol is not available to residents of jurisdictions where participation in DeFi, cryptocurrency staking, or token-based protocols is prohibited or restricted.</li>
          <li><strong>Tax Obligations.</strong> You are solely responsible for any tax obligations arising from your participation, including but not limited to capital gains, income tax, or reporting requirements.</li>
          <li><strong>Independent Project.</strong> THEO Pools is not endorsed by, affiliated with, or sponsored by the X1 Network Foundation or any other third party.</li>
          <li><strong>Age Requirement.</strong> You must be at least 18 years old, or the legal age of majority in your jurisdiction, to participate.</li>
        </ol>

        <p style={{ color: "var(--accent)", fontSize: ".8rem", fontWeight: 700, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>5. Liability</p>
        <ol style={{ color: "#aaa", fontSize: ".85rem", lineHeight: 1.8, paddingLeft: "1.2rem", marginBottom: "1rem" }}>
          <li><strong>Limitation of Liability.</strong> The creators, contributors, and operators of THEO Pools disclaim all liability for any direct, indirect, incidental, or consequential damages arising from your participation.</li>
          <li><strong>No Warranty.</strong> This protocol is provided "as is" without warranty of any kind, express or implied.</li>
          <li><strong>Assumption of Risk.</strong> By participating you expressly acknowledge that you understand the risks involved and assume full responsibility for your actions and outcomes.</li>
        </ol>

        <p style={{ color: "#aaa", fontSize: ".85rem", margin: "1rem 0" }}>By clicking "I Agree," you confirm that you are at least 18 years old, have read and understood all terms above, and accept full responsibility for your participation in THEO Pools.</p>
        <button onClick={onClose} style={{ background: "var(--accent)", color: "#0b132b", border: "none", padding: ".75rem 2rem", borderRadius: 6, fontWeight: 800, cursor: "pointer", width: "100%", fontSize: "1rem" }}>
          I AGREE — ENTER SITE
        </button>
      </div>
    </div>
  );
}
