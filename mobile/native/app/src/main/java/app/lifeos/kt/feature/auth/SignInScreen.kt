package app.lifeos.kt.feature.auth

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.lifeos.kt.core.designsystem.IconBadge
import app.lifeos.kt.core.designsystem.rememberHaptics
import app.lifeos.kt.data.AccountRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import java.io.IOException
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException

/** Google sign-in runs on the website (Google won't run inside apps) and hands the session back. */
private const val GOOGLE_HANDOFF = "https://lifeos0.vercel.app/auth?handoff=native"

data class SignInState(val pending: Boolean = false, val error: String? = null)

@HiltViewModel
class SignInViewModel @Inject constructor(private val account: AccountRepository) : ViewModel() {
    private val _state = MutableStateFlow(SignInState())
    val state: StateFlow<SignInState> = _state

    fun demo() = viewModelScope.launch { account.startDemo() }

    fun google(result: GoogleResult) {
        when (result) {
            GoogleResult.Cancelled -> Unit
            is GoogleResult.Failed -> _state.value = SignInState(error = result.message)
            is GoogleResult.Token -> {
                _state.value = SignInState(pending = true)
                viewModelScope.launch {
                    _state.value = try {
                        account.signInWithGoogle(result.token.idToken, result.token.nonce)
                        SignInState()
                    } catch (e: HttpException) {
                        SignInState(error = "Supabase didn't accept the Google sign-in (${e.code()}). Email and password still work.")
                    } catch (e: IOException) {
                        SignInState(error = "No connection. Signing in needs the internet once; after that the app works offline.")
                    }
                }
            }
        }
    }

    fun signIn(email: String, password: String) {
        if (_state.value.pending || email.isBlank() || password.isEmpty()) return
        _state.value = SignInState(pending = true)
        viewModelScope.launch {
            _state.value = try {
                account.signIn(email.trim(), password)
                SignInState()
            } catch (e: HttpException) {
                SignInState(error = if (e.code() == 400) "That email and password don't match." else "Sign-in failed (${e.code()}).")
            } catch (e: IOException) {
                SignInState(error = "No connection. Signing in needs the internet once; after that the app works offline.")
            }
        }
    }
}

@Composable
fun SignInScreen(model: SignInViewModel = hiltViewModel()) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val haptics = rememberHaptics()
    val state by model.state.collectAsStateWithLifecycle()
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(state.error) { if (state.error != null) haptics.reject() }

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            Modifier.safeDrawingPadding().imePadding().padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            IconBadge(Icons.Outlined.AutoAwesome, size = 56.dp)
            Spacer(Modifier.height(20.dp))
            Text("Life OS", style = MaterialTheme.typography.headlineLarge)
            Spacer(Modifier.height(6.dp))
            Text(
                "Sign in once. Everything is kept on this phone after that, with or without internet.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(28.dp))
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email") },
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                singleLine = true,
                shape = MaterialTheme.shapes.medium,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { model.signIn(email, password) }),
                modifier = Modifier.fillMaxWidth(),
            )
            AnimatedVisibility(state.error != null) {
                Text(
                    state.error.orEmpty(),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = { haptics.tick(); model.signIn(email, password) },
                enabled = !state.pending,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                if (state.pending) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                else Text("Sign in")
            }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = {
                    haptics.tick()
                    if (nativeGoogleSignIn) scope.launch { model.google(googleSignIn(context)) }
                    else context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(GOOGLE_HANDOFF)))
                },
                enabled = !state.pending,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) { Text("Continue with Google") }
            Spacer(Modifier.height(4.dp))
            TextButton(onClick = { haptics.tick(); model.demo() }, modifier = Modifier.fillMaxWidth()) { Text("Try the demo — sample data, nothing sent") }
        }
    }
}
