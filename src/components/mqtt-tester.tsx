"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, TestTube, Wifi, Sprout } from "lucide-react"

interface MqttConfig {
  host: string
  port: number
  protocol: "ws" | "wss"
  username?: string
  password?: string
}

export function MqttTester() {
  const [config, setConfig] = useState<MqttConfig>({
    host: "5c7e9968188d442585b4d705796ecfac.s1.eu.hivemq.cloud",
    port: 8884,
    protocol: "wss",
    username: "Cosme",
    password: "Upn2025UG",
  })

  const [testResults, setTestResults] = useState<string[]>([])
  const [isVisible, setIsVisible] = useState(false)

  const presetConfigs = [
    {
      name: "🌱 Tu Smart Farm",
      config: {
        host: "5c7e9968188d442585b4d705796ecfac.s1.eu.hivemq.cloud",
        port: 8884,
        protocol: "wss" as const,
        username: "Cosme",
        password: "Upn2025UG",
      },
    },
    {
      name: "🔧 HiveMQ Público",
      config: { host: "broker.hivemq.com", port: 8000, protocol: "ws" as const },
    },
    {
      name: "🧪 Mosquitto Test",
      config: { host: "test.mosquitto.org", port: 8080, protocol: "ws" as const },
    },
  ]

  const testConnection = async (testConfig: MqttConfig) => {
    const mqtt = await import("mqtt")
    const url = `${testConfig.protocol}://${testConfig.host}:${testConfig.port}/mqtt`

    setTestResults((prev) => [...prev, `🔄 Probando conexión: ${testConfig.host}:${testConfig.port}`])

    try {
      const client = mqtt.connect(url, {
        clientId: `test_farm_${Math.random().toString(16).substr(2, 8)}`,
        connectTimeout: 10000,
        clean: true,
        username: testConfig.username,
        password: testConfig.password,
        rejectUnauthorized: testConfig.protocol === "wss",
      })

      const timeout = setTimeout(() => {
        setTestResults((prev) => [...prev, `❌ Timeout: ${testConfig.host}`])
        client.end(true)
      }, 15000)

      client.on("connect", () => {
        clearTimeout(timeout)
        setTestResults((prev) => [...prev, `✅ Conexión exitosa: ${testConfig.host}`])
        client.end()
      })

      client.on("error", (err) => {
        clearTimeout(timeout)
        setTestResults((prev) => [...prev, `❌ Error: ${testConfig.host} - ${err.message}`])
      })
    } catch (error) {
      setTestResults((prev) => [...prev, `❌ Excepción: ${testConfig.host} - ${error}`])
    }
  }

  if (!isVisible) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-r from-teal-50 to-green-50">
        <CardContent className="p-4">
          <Button
            onClick={() => setIsVisible(true)}
            variant="outline"
            className="w-full border-green-200 text-green-700 hover:bg-green-50"
          >
            <Settings className="w-4 h-4 mr-2" />
            Mostrar Probador de Conexión
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-xl bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50">
      <CardHeader className="bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-3">
          <Wifi className="w-6 h-6" />
          Probador de Conexión Smart Farm
        </CardTitle>
        <CardDescription className="text-teal-100">
          Verifica la conectividad con tu sistema de cultivo Arduino
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Configuración manual */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Input
            placeholder="Servidor"
            value={config.host}
            onChange={(e) => setConfig((prev) => ({ ...prev, host: e.target.value }))}
            className="border-green-200 focus:border-green-400"
          />
          <Input
            placeholder="Puerto"
            type="number"
            value={config.port}
            onChange={(e) => setConfig((prev) => ({ ...prev, port: Number.parseInt(e.target.value) }))}
            className="border-green-200 focus:border-green-400"
          />
          <select
            className="flex h-10 w-full rounded-md border border-green-200 bg-background px-3 py-2 text-sm focus:border-green-400"
            value={config.protocol}
            onChange={(e) => setConfig((prev) => ({ ...prev, protocol: e.target.value as "ws" | "wss" }))}
          >
            <option value="ws">WebSocket (ws)</option>
            <option value="wss">WebSocket SSL (wss)</option>
          </select>
          <Input
            placeholder="Usuario"
            value={config.username || ""}
            onChange={(e) => setConfig((prev) => ({ ...prev, username: e.target.value }))}
            className="border-green-200 focus:border-green-400"
          />
          <Input
            placeholder="Contraseña"
            type="password"
            value={config.password || ""}
            onChange={(e) => setConfig((prev) => ({ ...prev, password: e.target.value }))}
            className="border-green-200 focus:border-green-400"
          />
          <Button
            onClick={() => testConnection(config)}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Probar
          </Button>
        </div>

        {/* Configuraciones predefinidas */}
        <div className="flex flex-wrap gap-3">
          {presetConfigs.map((preset, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => testConnection(preset.config)}
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              {preset.name}
            </Button>
          ))}
        </div>

        {/* Resultados */}
        {testResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-green-800 flex items-center gap-2">
                <Sprout className="w-4 h-4" />
                Resultados de Pruebas
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestResults([])}
                className="text-xs border-green-200 text-green-600 hover:bg-green-50"
              >
                Limpiar
              </Button>
            </div>
            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-green-100 max-h-40 overflow-y-auto">
              {testResults.slice(-10).map((result, index) => (
                <div key={index} className="text-sm font-mono text-gray-700 py-1">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={() => setIsVisible(false)}
          variant="ghost"
          size="sm"
          className="w-full text-green-600 hover:bg-green-50"
        >
          Ocultar Probador
        </Button>
      </CardContent>
    </Card>
  )
}
