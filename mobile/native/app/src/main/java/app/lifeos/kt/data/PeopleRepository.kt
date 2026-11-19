package app.lifeos.kt.data

import app.lifeos.kt.core.common.nowIso
import app.lifeos.kt.core.model.Person
import app.lifeos.kt.core.model.PersonInteraction
import app.lifeos.kt.core.model.PersonLink
import app.lifeos.kt.core.model.RelationshipRule
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow

/** Relationships: your people, the contact you logged, how they link, and which reminders you want. */
@Singleton
class PeopleRepository @Inject constructor(private val store: LocalStore) {
    val people: Flow<List<Person>> = store.observe("people", Person.serializer())
    val interactions: Flow<List<PersonInteraction>> = store.observe("person_interactions", PersonInteraction.serializer())
    val links: Flow<List<PersonLink>> = store.observe("person_links", PersonLink.serializer())
    val rules: Flow<List<RelationshipRule>> = store.observe("relationship_rules", RelationshipRule.serializer())

    suspend fun save(person: Person) = store.save("people", Person.serializer(), person)

    /** A person goes with their contact log and links (the server cascades the same way). */
    suspend fun delete(person: Person, interactions: List<PersonInteraction>, links: List<PersonLink>) {
        interactions.filter { it.personId == person.id }.forEach { store.delete("person_interactions", it.id) }
        links.filter { it.fromPerson == person.id || it.toPerson == person.id }.forEach { store.delete("person_links", it.id) }
        store.delete("people", person.id)
    }

    suspend fun log(personId: String, kind: String, date: String, note: String?): PersonInteraction {
        val item = PersonInteraction(newId(), personId, kind, date, note?.trim()?.ifEmpty { null })
        store.save("person_interactions", PersonInteraction.serializer(), item)
        return item
    }

    suspend fun delete(interaction: PersonInteraction) = store.delete("person_interactions", interaction.id)
    suspend fun save(link: PersonLink) = store.save("person_links", PersonLink.serializer(), link)
    suspend fun delete(link: PersonLink) = store.delete("person_links", link.id)
    suspend fun save(rule: RelationshipRule) = store.save("relationship_rules", RelationshipRule.serializer(), rule.copy(createdAt = rule.createdAt ?: nowIso()))
    suspend fun delete(rule: RelationshipRule) = store.delete("relationship_rules", rule.id)
}
