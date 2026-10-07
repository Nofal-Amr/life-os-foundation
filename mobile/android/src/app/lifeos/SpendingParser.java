package app.lifeos;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads a bank or wallet message on the phone and keeps only what's needed
 * to log spending: the amount, the currency and (if it says) where. Anything
 * that looks like a one-time code is dropped before it's even read, and money
 * coming in is ignored. Plain Java so it can be tested off the phone.
 */
final class SpendingParser {
    static final class Spend {
        final double amount;
        final String currency;
        final String merchant;

        Spend(double amount, String currency, String merchant) {
            this.amount = amount;
            this.currency = currency;
            this.merchant = merchant;
        }
    }

    /** One-time codes, passwords, verification: never read past this. */
    private static final Pattern SECRET = Pattern.compile(
        "(?i)\\b(otp|one[- ]?time|verification|verify|passcode|password|pin\\b|security code|auth(entication)? code|code)"
            + "|رمز|كود|كلمة السر|كلمة المرور|التحقق|لمرة واحدة|الرقم السري");

    private static final Pattern SPEND = Pattern.compile(
        "(?i)\\b(debited|debit|purchase[d]?|spent|paid|payment|withdrawn|withdrawal|pos\\b|charged|transfer(red)? to|sent|cash out)"
            + "|خصم|شراء|دفع|سحب|تحويل إلى|تم تحويل|مشتريات");

    private static final Pattern INCOME = Pattern.compile(
        "(?i)\\b(credited|received|deposit(ed)?|refund(ed)?|incoming transfer|salary)"
            + "|إيداع|استلام|تم إضافة|أضيف|استرداد|وارد|راتب");

    private static final String CURRENCY =
        "(EGP|E\\.?G\\.?P|L\\.?E\\.?|USD|US\\$|\\$|EUR|€|SAR|AED|GBP|£|جنيه(?:ا)?|ج\\.?م\\.?|ريال|درهم|دولار)";
    private static final String NUMBER = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)";
    private static final Pattern AMOUNT_AFTER = Pattern.compile(CURRENCY + "\\s*" + NUMBER);
    private static final Pattern AMOUNT_BEFORE = Pattern.compile(NUMBER + "\\s*" + CURRENCY);
    /** An amount right after these words is a balance, not the spending. */
    private static final Pattern BALANCE_BEFORE = Pattern.compile(
        "(?i)(balance|bal\\.?|available|avl\\.?|limit|رصيد|الرصيد|المتاح|الحد)[^\\d]{0,20}$");

    private static final Pattern MERCHANT = Pattern.compile(
        // (?U): Java's \b only knows Arabic letters as letters in Unicode mode.
        "(?iU)(?:\\bat\\b|\\bto\\b|\\bfrom merchant\\b|لدى|عند|إلى|الى|في)\\s+([^\\n,.;:]{2,40}?)"
            + "(?=\\s+(?:on|at|using|via|with|card|بتاريخ|يوم|في|ببطاقة|بطاقة|رصيد|الرصيد)\\b|[,.;:\\n]|$)");

    private SpendingParser() {}

    /** The spending in a message, or null if it isn't clearly money going out. */
    static Spend parse(String raw) {
        if (raw == null || raw.isEmpty() || raw.length() > 2000) return null;
        String text = normaliseDigits(raw);
        if (SECRET.matcher(text).find()) return null;
        if (!SPEND.matcher(text).find()) return null;
        if (INCOME.matcher(text).find() && !SPEND.matcher(firstClause(text)).find()) return null;

        Double amount = null;
        String currency = null;
        int earliest = Integer.MAX_VALUE;
        for (Pattern pattern : new Pattern[] { AMOUNT_AFTER, AMOUNT_BEFORE }) {
            Matcher m = pattern.matcher(text);
            while (m.find()) {
                if (BALANCE_BEFORE.matcher(text.substring(0, m.start())).find()) continue;
                if (m.start() >= earliest) break;
                boolean currencyFirst = pattern == AMOUNT_AFTER;
                String number = currencyFirst ? m.group(2) : m.group(1);
                String code = currencyFirst ? m.group(1) : m.group(2);
                double value;
                try {
                    value = Double.parseDouble(number.replace(",", ""));
                } catch (NumberFormatException e) {
                    continue;
                }
                if (value <= 0 || value > 10_000_000) continue;
                amount = value;
                currency = currencyCode(code);
                earliest = m.start();
                break;
            }
        }
        if (amount == null) return null;
        return new Spend(amount, currency, merchant(text));
    }

    private static String firstClause(String text) {
        int stop = text.indexOf('.');
        return stop > 0 ? text.substring(0, stop) : text;
    }

    private static String merchant(String text) {
        Matcher m = MERCHANT.matcher(text);
        while (m.find()) {
            String name = m.group(1).trim();
            if (name.matches(".*\\d{4,}.*")) continue; // a card or account number
            if (name.length() < 2) continue;
            return name;
        }
        return null;
    }

    static String currencyCode(String raw) {
        String value = raw.toUpperCase(Locale.ROOT).replace(".", "");
        if (value.startsWith("EG") || value.equals("LE") || raw.startsWith("جنيه") || raw.startsWith("ج")) return "EGP";
        if (value.contains("$") || value.equals("USD") || raw.equals("دولار")) return "USD";
        if (value.equals("EUR") || value.equals("€")) return "EUR";
        if (value.equals("SAR") || raw.equals("ريال")) return "SAR";
        if (value.equals("AED") || raw.equals("درهم")) return "AED";
        if (value.equals("GBP") || value.equals("£")) return "GBP";
        return value;
    }

    /** Arabic-Indic digits and separators to plain ones. */
    static String normaliseDigits(String text) {
        StringBuilder out = new StringBuilder(text.length());
        for (char c : text.toCharArray()) {
            if (c >= '٠' && c <= '٩') out.append((char) ('0' + (c - '٠')));
            else if (c >= '۰' && c <= '۹') out.append((char) ('0' + (c - '۰')));
            else if (c == '٫') out.append('.');
            else if (c == '٬') out.append(',');
            else out.append(c);
        }
        return out.toString();
    }
}
