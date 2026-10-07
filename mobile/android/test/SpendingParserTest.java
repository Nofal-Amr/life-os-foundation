package app.lifeos;

/**
 * Off-phone check of SpendingParser: run with `npm run test:android`.
 * Plain Java, no test framework; exits non-zero on the first failure.
 */
public class SpendingParserTest {
    private static int failures = 0;

    private static void spend(String text, double amount, String currency, String merchant) {
        SpendingParser.Spend s = SpendingParser.parse(text);
        if (s == null || Math.abs(s.amount - amount) > 0.001 || !currency.equals(s.currency)
            || (merchant == null ? s.merchant != null : !merchant.equals(s.merchant))) {
            failures++;
            System.out.println("FAIL spend: " + text + "\n  got " + (s == null ? "null"
                : s.amount + " " + s.currency + " @ " + s.merchant));
        }
    }

    private static void ignored(String text) {
        if (SpendingParser.parse(text) != null) {
            failures++;
            System.out.println("FAIL should ignore: " + text);
        }
    }

    public static void main(String[] args) {
        // Spending, English.
        spend("Your card ending 1234 was debited with EGP 250.00 at CARREFOUR MAADI on 08/10. Available balance EGP 5,120.50",
            250.0, "EGP", "CARREFOUR MAADI");
        spend("Purchase of 1,299.99 EGP at Amazon.eg using card **4567. Bal: 3,000 EGP", 1299.99, "EGP", "Amazon");
        spend("You have sent EGP 500 to Ahmed Ali via InstaPay.", 500.0, "EGP", "Ahmed Ali");
        spend("POS purchase USD 12.50 at NETFLIX.COM", 12.5, "USD", "NETFLIX");
        // Spending, Arabic (and Arabic digits).
        spend("تم خصم ٣٥٠ جنيه من حسابك لدى فودافون كاش. الرصيد المتاح ١٢٠٠ جنيه", 350.0, "EGP", "فودافون كاش");
        spend("عملية شراء بمبلغ 75.5 ج.م عند طلبات بتاريخ 08/10", 75.5, "EGP", "طلبات");
        // Never: one-time codes.
        ignored("Your OTP for the purchase of EGP 250 at CARREFOUR is 482913. Do not share it.");
        ignored("رمز التحقق الخاص بك لعملية شراء بمبلغ 250 جنيه هو 4829");
        ignored("Use code 123456 to verify your payment of EGP 99");
        // Never: money coming in.
        ignored("Your account was credited with EGP 10,200 salary.");
        ignored("تم إيداع 500 جنيه في حسابك");
        // Never: no currency, or no spending word.
        ignored("Your order 12345 has shipped.");
        ignored("Reminder: your balance is EGP 3,000.");

        if (failures > 0) {
            System.out.println(failures + " failed");
            System.exit(1);
        }
        System.out.println("SpendingParser: all passed");
    }
}
