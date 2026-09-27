import { LockKeyhole, UserRound, FileCheck2 } from 'lucide-react';

export function PrivacyAndAccess() {
  return <div className="privacy-page">
    <header><p className="section-kicker">YOUR INFORMATION</p><h2>A workspace for your business.</h2><p>Know what is used, where it goes and what remains your decision.</p></header>
    <div className="privacy-principles">
      <section><UserRound size={22}/><h3>Your account sets the boundary</h3><p>Requests use your signed-in account. Business records and saved conversations are checked against business ownership. The coach cannot choose another business or search other owners’ records.</p></section>
      <section><LockKeyhole size={22}/><h3>You stay in control</h3><p>Coaching does not send customer messages, take payments or change financial records. You review the suggestion and make the change yourself. Premium access is checked by the database.</p></section>
      <section><FileCheck2 size={22}/><h3>Check and challenge the answer</h3><p>Figures are calculated from saved records. Missing information is identified. Ask why, request a smaller step or say the suggestion does not fit. There is no business credit score or demographic ranking.</p></section>
    </div>
    <section className="card"><h3>What leaves this workspace?</h3><div className="report-table-wrap"><table className="report-table privacy-table"><thead><tr><th scope="col">When you use</th><th scope="col">Information processed</th><th scope="col">Provider</th></tr></thead><tbody>
      <tr><th scope="row">Business records</th><td>Records and saved advice linked to your account</td><td>Supabase</td></tr>
      <tr><th scope="row">Typed coaching</th><td>Your question and, for follow-ups, the previous topic. Not your financial records or other owners’ conversations.</td><td>Groq</td></tr>
      <tr><th scope="row">Premium textbook</th><td>Your business type, stage, saved service names, town and a size band. Not your figures, customers or payments; those are added to the PDF in your browser.</td><td>Groq</td></tr>
      <tr><th scope="row">Campaign generator</th><td>Your campaign goal, chosen service, offer, audience notes, saved service names and town.</td><td>Groq</td></tr>
      <tr><th scope="row">AI quality monitoring</th><td>For each AI request: feature, topic label, success or failure, response time and token count. Answer ratings you choose to give. Never your question or the answer text.</td><td>Supabase</td></tr>
      <tr><th scope="row">A photo you attach</th><td>The image for transcription. Avoid identity documents, account numbers and customer contact details.</td><td>Groq</td></tr>
      <tr><th scope="row">Optional web research</th><td>Your saved town and a general business search. Not your private question or records.</td><td>Serper</td></tr>
      <tr><th scope="row">Optional voice input</th><td>Speech may be processed by your browser’s speech service. Typed input is always available.</td><td>Your browser’s provider</td></tr>
    </tbody></table></div><p className="muted compact">Provider retention depends on the service and account settings. BizWise cannot promise that third-party processing has zero retention. Do not include information that is not needed for your question.</p></section>
    <section className="privacy-practical"><h3>Designed for everyday access</h3><p>Use plain language, type instead of speaking, and skip photo uploads or web research to use less data. Core records and selected learning guides remain available without Premium. An internet connection is required to save or request coaching.</p><h3>When something looks wrong</h3><p>Check the original record first. Use “This does not fit” in the conversation to question a recommendation. Keep the response time and saved action when reporting an issue to your workspace administrator. Sign out when using a shared device.</p></section>
  </div>;
}
