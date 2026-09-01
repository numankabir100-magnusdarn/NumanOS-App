package com.numanos.gateway

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sharedText = extractSharedText(intent)
        val sharedUri = extractSharedUri(intent)

        if (sharedText.isNullOrBlank() && sharedUri == null) {
            Toast.makeText(this, "NuManOS Gateway opened without shared content.", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val payloadText = sharedText ?: "Shared file: ${sharedUri?.lastPathSegment ?: "unknown"}"

        thread {
            val success = sendToNuManOS(payloadText)
            runOnUiThread {
                if (success) {
                    Toast.makeText(this, "Shared content sent to NuManOS.", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "Failed to send to NuManOS.", Toast.LENGTH_LONG).show()
                }
                finish()
            }
        }
    }

    private fun extractSharedText(intent: Intent?): String? {
        if (intent == null) return null
        if (intent.action == Intent.ACTION_SEND) {
            return intent.getStringExtra(Intent.EXTRA_TEXT)
        }
        return null
    }

    private fun extractSharedUri(intent: Intent?): Uri? {
        if (intent == null) return null
        if (intent.action == Intent.ACTION_SEND) {
            return intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
        }
        return null
    }

    private fun sendToNuManOS(text: String): Boolean {
        return try {
            val url = URL("http://192.168.1.25:8000/whatsapp/route")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.doInput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.connectTimeout = 15000
            connection.readTimeout = 15000

            val payload = """
                {"text": "${text.replace("\\", "\\\\").replace("\"", "\\\"")}", "sender": "AndroidGateway"}
            """.trimIndent()

            val output = OutputStreamWriter(connection.outputStream)
            output.write(payload)
            output.flush()
            output.close()

            val responseCode = connection.responseCode
            val responseBody = if (responseCode in 200..299) {
                val reader = BufferedReader(InputStreamReader(connection.inputStream))
                reader.readText()
            } else {
                val reader = BufferedReader(InputStreamReader(connection.errorStream))
                reader.readText()
            }

            connection.disconnect()
            responseCode in 200..299
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
