// Wording people agree to when they sign. A copy is saved with each
// signature, so changing this later doesn't change what someone already signed.
// DRAFT: have HR or your attorney review before going live.
export function signOffStatement(sop: { id: string; title: string; revision: string }) {
  return (
    `I confirm that I have read and understand ${sop.id} ${sop.title} (Revision ${sop.revision}). ` +
    "I have had the chance to ask questions about it, and I will follow it in my work. " +
    "I understand that not following this procedure may lead to retraining or other action under company policy. " +
    "I agree that typing my name below is my electronic signature and has the same effect as signing by hand."
  );
}

export function refresherStatement(sop: { id: string; title: string; revision: string }) {
  return (
    `I confirm that I have reviewed ${sop.id} ${sop.title} (Revision ${sop.revision}) again, including any changes since I last signed, ` +
    "and that I will keep following it in my work. " +
    "I agree that typing my name below is my electronic signature and has the same effect as signing by hand."
  );
}

// Percent needed to pass a refresher quiz.
export const PASS_MARK = 80;

// How often an assignment can ask for a refresher, in months.
export const REFRESH_CHOICES = [1, 2, 3, 6, 12];
export const DEFAULT_REFRESH_MONTHS = 2;

export const certNumber = (id: string) => id.replace(/-/g, "").slice(0, 10).toUpperCase();
