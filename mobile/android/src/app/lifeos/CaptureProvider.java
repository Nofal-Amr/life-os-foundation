package app.lifeos;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Hands the camera app a place to save a photo (and the page a way to read
 * it back): content://app.lifeos.capture/<name>.jpg, backed by a file in
 * this app's cache. Only names this app made are allowed, and only while the
 * camera intent holds the URI permission we grant it.
 */
public class CaptureProvider extends ContentProvider {
    static final String AUTHORITY = "app.lifeos.capture";

    static File dir(android.content.Context context) {
        File dir = new File(context.getCacheDir(), "captures");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return dir;
    }

    static Uri newPhoto(android.content.Context context) {
        // Old captures go first; a photo is only needed until the page reads it.
        File[] old = dir(context).listFiles();
        if (old != null) for (File file : old) if (System.currentTimeMillis() - file.lastModified() > 3_600_000) file.delete();
        String name = "photo-" + System.currentTimeMillis() + ".jpg";
        return Uri.parse("content://" + AUTHORITY + "/" + name);
    }

    private File fileFor(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || !name.matches("photo-\\d+\\.jpg")) throw new FileNotFoundException(String.valueOf(uri));
        return new File(dir(getContext()), name);
    }

    static long sizeOf(android.content.Context context, Uri uri) {
        String name = uri.getLastPathSegment();
        if (name == null || !name.matches("photo-\\d+\\.jpg")) return 0;
        return new File(dir(context), name).length();
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = fileFor(uri);
        int flags = mode.contains("w")
            ? ParcelFileDescriptor.MODE_WRITE_ONLY | ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE
            : ParcelFileDescriptor.MODE_READ_ONLY;
        return ParcelFileDescriptor.open(file, flags);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        MatrixCursor cursor = new MatrixCursor(new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE });
        try {
            File file = fileFor(uri);
            cursor.addRow(new Object[] { file.getName(), file.length() });
        } catch (FileNotFoundException ignored) {
            // Empty.
        }
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return "image/jpeg";
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] args) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] args) {
        return 0;
    }
}
