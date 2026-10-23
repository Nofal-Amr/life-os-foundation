package app.lifeos.kt.data.logic

import app.lifeos.kt.core.model.Note

/** `#work`, `#مشروع`, `#plan-2026`: a label typed in the note's text. */
private val HASHTAG = Regex("""(?<![\p{L}\p{N}_])#([\p{L}\p{N}_-]{1,32})""")

/** Labels written as #words in [text], without the #, in the order they appear. */
fun hashtagsIn(text: String): List<String> = HASHTAG.findAll(text).map { it.groupValues[1] }.distinct().toList()

/**
 * The labels a note is saved with: the ones chosen, plus any #word in an
 * unlocked note's text. A locked note's text is never read for labels, so
 * nothing in it ends up readable on the server.
 */
fun labelsFor(chosen: List<String>, body: String, locked: Boolean): List<String> {
    val all = if (locked) chosen else chosen + hashtagsIn(body)
    return all.map { it.trim().removePrefix("#") }.filter { it.isNotEmpty() }.distinctBy { it.lowercase() }
}

/** Every label in use, most used first, as the web's label filter shows them. */
fun allLabels(notes: List<Note>): List<String> = notes.filter { !it.archived }
    .flatMap { note -> note.tags.distinctBy { it.lowercase() } }
    .groupingBy { it }.eachCount()
    .entries.sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key.lowercase() })
    .map { it.key }

/** Notes shown for a label (null: all) and search text; pinned first, then newest. */
fun filterNotes(notes: List<Note>, label: String?, search: String, searchable: (Note) -> String): List<Note> = notes
    .filter { !it.archived }
    .filter { label == null || it.tags.any { tag -> tag.equals(label, ignoreCase = true) } }
    .filter { search.isBlank() || searchable(it).contains(search.trim(), ignoreCase = true) }
    .sortedWith(compareByDescending<Note> { it.pinned }.thenByDescending { it.updatedAt ?: "" })
