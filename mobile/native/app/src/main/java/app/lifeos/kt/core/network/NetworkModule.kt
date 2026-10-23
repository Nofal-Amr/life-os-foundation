package app.lifeos.kt.core.network

import app.lifeos.kt.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    /** Reads what the server sends (new columns are fine) and writes nulls explicitly (a cleared field). */
    @Provides
    @Singleton
    fun json(): Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        encodeDefaults = true
        explicitNulls = true
    }

    private fun retrofit(client: OkHttpClient, json: Json): Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.SUPABASE_URL.trimEnd('/') + "/")
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    private fun baseClient() = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)

    /** Sign-in and refresh: the publishable key only. */
    @Provides
    @Singleton
    @Named("auth")
    fun authClient(): OkHttpClient = baseClient().addInterceptor(SupabaseInterceptor(BuildConfig.SUPABASE_KEY, null)).build()

    @Provides
    @Singleton
    fun authApi(@Named("auth") client: OkHttpClient, json: Json): AuthApi = retrofit(client, json).create(AuthApi::class.java)

    @Provides
    @Singleton
    fun restApi(tokens: TokenProvider, json: Json): RestApi {
        val client = baseClient()
            .addInterceptor(SupabaseInterceptor(BuildConfig.SUPABASE_KEY, tokens))
            .authenticator(SupabaseAuthenticator(tokens))
            .build()
        return retrofit(client, json).create(RestApi::class.java)
    }
}
