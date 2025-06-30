"use client"

import type React from "react"
import { useEffect, useState } from "react"
import mqtt from "mqtt"
import {
  Bot,
  Wifi,
  WifiOff,
  Send,
  Sprout,
  Thermometer,
  Droplets,
  Sun,
  Activity,
  Zap,
  Gauge,
  Leaf,
  Settings2,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"
import { MqttTester } from "@/components/mqtt-tester"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface MqttMessage {
  topic: string
  message: string
  timestamp: Date
}

interface ChatMessage {
  type: "user" | "bot"
  content: string
  timestamp: Date
}

interface SensorData {
  temperature?: number
  humidity?: number
  soilMoisture?: number
  lightLevel?: number
  pH?: number
  nutrients?: number
}

export default function SmartFarmDashboard() {
  const [client, setClient] = useState<mqtt.MqttClient | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<MqttMessage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [connectionStatus, setConnectionStatus] = useState("Desconectado")
  const [sensorData, setSensorData] = useState<SensorData>({})

  // Configuración MQTT para sistema de cultivo
  const mqttConfig = {
    host: "5c7e9968188d442585b4d705796ecfac.s1.eu.hivemq.cloud",
    port: 8884,
    protocol: "wss" as const,
    username: "Cosme",
    password: "Upn2025UG",
    clientId: `SmartFarm_${Math.random().toString(16).substr(2, 8)}`,
    keepalive: 60,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
    clean: true,
  }

  useEffect(() => {
    console.log("🌱 Conectando al Sistema de Cultivo Inteligente...")

    const connectUrl = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}/mqtt`

    const mqttClient = mqtt.connect(connectUrl, {
      clientId: mqttConfig.clientId,
      username: mqttConfig.username,
      password: mqttConfig.password,
      clean: mqttConfig.clean,
      connectTimeout: mqttConfig.connectTimeout,
      reconnectPeriod: mqttConfig.reconnectPeriod,
      keepalive: mqttConfig.keepalive,
      protocolVersion: 4,
      rejectUnauthorized: true,
      wsOptions: {
        rejectUnauthorized: true,
      },
    })

    mqttClient.on("connect", (connack) => {
      console.log("✅ Sistema de Cultivo Conectado", connack)
      setIsConnected(true)
      setConnectionStatus("Sistema Activo")

      // Topics específicos para cultivo con Arduino
      const farmTopics = [
        "smartfarm/sensors/temperature",
        "smartfarm/sensors/humidity",
        "smartfarm/sensors/soil_moisture",
        "smartfarm/sensors/light_level",
        "smartfarm/sensors/ph",
        "smartfarm/sensors/nutrients",
        "smartfarm/actuators/irrigation",
        "smartfarm/actuators/lighting",
        "smartfarm/actuators/ventilation",
        "smartfarm/alerts/#",
        "Sensores/7",
        "Sensores/ChatLog",
        "arduino/data/#",
        "VicUPN/farm/#",
      ]

      farmTopics.forEach((topic) => {
        mqttClient.subscribe(topic, { qos: 1 }, (err) => {
          if (!err) {
            console.log(`🌿 Suscrito a: ${topic}`)
          }
        })
      })

      // Mensaje de inicio del sistema
      mqttClient.publish(
        "smartfarm/system/status",
        JSON.stringify({
          status: "Dashboard conectado",
          timestamp: new Date().toISOString(),
          clientId: mqttConfig.clientId,
        }),
        { qos: 1 },
      )
    })

    mqttClient.on("message", (topic, message) => {
      console.log(`📊 Datos recibidos en ${topic}:`, message.toString())

      const newMessage: MqttMessage = {
        topic,
        message: message.toString(),
        timestamp: new Date(),
      }
      setMessages((prev) => [newMessage, ...prev.slice(0, 49)])

      // Procesar datos de sensores
      try {
        const data = JSON.parse(message.toString())
        updateSensorData(topic, data)
      } catch {
        // Si no es JSON, procesar como valor simple
        updateSensorData(topic, { value: message.toString() })
      }
    })

    mqttClient.on("error", (err) => {
      console.error("❌ Error del Sistema:", err)
      if (err.message.includes("Connection refused")) {
        setConnectionStatus("Error: Credenciales incorrectas")
      } else if (err.message.includes("timeout")) {
        setConnectionStatus("Error: Timeout de conexión")
      } else {
        setConnectionStatus(`Error: ${err.message}`)
      }
      setIsConnected(false)
    })

    mqttClient.on("offline", () => {
      setIsConnected(false)
      setConnectionStatus("Sistema Desconectado")
    })

    mqttClient.on("reconnect", () => {
      setConnectionStatus("Reconectando Sistema...")
    })

    setClient(mqttClient)

    return () => {
      if (mqttClient) {
        mqttClient.end()
      }
    }
  }, [])

  const updateSensorData = (topic: string, data: any) => {
    setSensorData((prev) => {
      const newData = { ...prev }

      if (topic.includes("temperature")) {
        newData.temperature = typeof data === "object" ? data.value || data.temperature : Number.parseFloat(data)
      } else if (topic.includes("humidity")) {
        newData.humidity = typeof data === "object" ? data.value || data.humidity : Number.parseFloat(data)
      } else if (topic.includes("soil_moisture")) {
        newData.soilMoisture = typeof data === "object" ? data.value || data.moisture : Number.parseFloat(data)
      } else if (topic.includes("light")) {
        newData.lightLevel = typeof data === "object" ? data.value || data.light : Number.parseFloat(data)
      } else if (topic.includes("ph")) {
        newData.pH = typeof data === "object" ? data.value || data.ph : Number.parseFloat(data)
      } else if (topic.includes("nutrients")) {
        newData.nutrients = typeof data === "object" ? data.value || data.nutrients : Number.parseFloat(data)
      }

      return newData
    })
  }

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMessage: ChatMessage = {
      type: "user",
      content: chatInput,
      timestamp: new Date(),
    }

    setChatMessages((prev) => [...prev, userMessage])

    setTimeout(() => {
      const botResponse = generateFarmBotResponse(chatInput, messages, sensorData)
      const botMessage: ChatMessage = {
        type: "bot",
        content: botResponse,
        timestamp: new Date(),
      }
      setChatMessages((prev) => [...prev, botMessage])
    }, 500)

    setChatInput("")
  }

  const generateFarmBotResponse = (input: string, mqttMessages: MqttMessage[], sensors: SensorData): string => {
    const lowerInput = input.toLowerCase()

    if (lowerInput.includes("temperatura")) {
      if (sensors.temperature !== undefined) {
        const status = sensors.temperature > 30 ? "alta" : sensors.temperature < 15 ? "baja" : "óptima"
        return `🌡️ Temperatura actual: ${sensors.temperature}°C (${status}). Rango ideal para cultivos: 18-28°C.`
      }
      return "🌡️ No hay datos de temperatura disponibles. Verifica el sensor Arduino."
    }

    if (lowerInput.includes("humedad")) {
      if (sensors.humidity !== undefined) {
        const status = sensors.humidity > 80 ? "alta" : sensors.humidity < 40 ? "baja" : "buena"
        return `💧 Humedad ambiental: ${sensors.humidity}% (${status}). Rango ideal: 50-70%.`
      }
      return "💧 No hay datos de humedad disponibles."
    }

    if (lowerInput.includes("suelo") || lowerInput.includes("tierra")) {
      if (sensors.soilMoisture !== undefined) {
        const status = sensors.soilMoisture > 80 ? "muy húmedo" : sensors.soilMoisture < 30 ? "seco" : "adecuado"
        return `🌱 Humedad del suelo: ${sensors.soilMoisture}% (${status}). ${sensors.soilMoisture < 30 ? "¡Necesita riego!" : "Nivel adecuado."}`
      }
      return "🌱 No hay datos de humedad del suelo."
    }

    if (lowerInput.includes("luz") || lowerInput.includes("iluminación")) {
      if (sensors.lightLevel !== undefined) {
        const status = sensors.lightLevel > 80 ? "excelente" : sensors.lightLevel < 30 ? "insuficiente" : "adecuada"
        return `☀️ Nivel de luz: ${sensors.lightLevel}% (${status}). ${sensors.lightLevel < 30 ? "Considera activar iluminación artificial." : ""}`
      }
      return "☀️ No hay datos de iluminación disponibles."
    }

    if (lowerInput.includes("ph")) {
      if (sensors.pH !== undefined) {
        const status = sensors.pH > 7.5 ? "alcalino" : sensors.pH < 6.0 ? "ácido" : "neutro"
        return `⚗️ pH del suelo: ${sensors.pH} (${status}). Rango ideal: 6.0-7.0.`
      }
      return "⚗️ No hay datos de pH disponibles."
    }

    if (lowerInput.includes("nutrientes")) {
      if (sensors.nutrients !== undefined) {
        const status = sensors.nutrients > 80 ? "alto" : sensors.nutrients < 30 ? "bajo" : "adecuado"
        return `🧪 Nivel de nutrientes: ${sensors.nutrients}% (${status}). ${sensors.nutrients < 30 ? "Considera fertilizar." : ""}`
      }
      return "🧪 No hay datos de nutrientes disponibles."
    }

    if (lowerInput.includes("estado") || lowerInput.includes("resumen")) {
      const alerts = []
      if (sensors.temperature && (sensors.temperature > 30 || sensors.temperature < 15)) alerts.push("temperatura")
      if (sensors.soilMoisture && sensors.soilMoisture < 30) alerts.push("riego")
      if (sensors.lightLevel && sensors.lightLevel < 30) alerts.push("iluminación")

      return `📊 Estado del cultivo: ${alerts.length === 0 ? "✅ Condiciones óptimas" : `⚠️ Atención en: ${alerts.join(", ")}`}. Mensajes recibidos: ${mqttMessages.length}.`
    }

    if (lowerInput.includes("arduino") || lowerInput.includes("sensores")) {
      return `🔧 Sistema Arduino conectado. Sensores activos: ${Object.keys(sensors).length}. Verifica las conexiones si faltan datos.`
    }

    return `🤖 Soy tu asistente de cultivo inteligente. Pregúntame sobre: temperatura, humedad, suelo, luz, pH, nutrientes, o el estado general del sistema.`
  }

  const getSensorStatus = (value: number | undefined, min: number, max: number) => {
    if (value === undefined) return "sin-datos"
    if (value < min) return "bajo"
    if (value > max) return "alto"
    return "optimo"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header Moderno */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Sprout className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Smart Farm Dashboard</h1>
                <p className="text-green-100 text-lg">Sistema de Cultivo Inteligente con Arduino</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isConnected ? (
                <Badge className="bg-green-500/20 text-green-100 border-green-300/30 px-4 py-2 text-sm">
                  <Activity className="w-4 h-4 mr-2" />
                  {connectionStatus}
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-100 border-red-300/30 px-4 py-2 text-sm">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {connectionStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Métricas de Sensores */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {/* Temperatura */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-50 to-red-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Temperatura</p>
                  <p className="text-3xl font-bold text-orange-800">{sensorData.temperature?.toFixed(1) || "--"}°C</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Thermometer className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                  getSensorStatus(sensorData.temperature, 18, 28) === "optimo"
                    ? "bg-green-100 text-green-700"
                    : getSensorStatus(sensorData.temperature, 18, 28) === "alto"
                      ? "bg-red-100 text-red-700"
                      : getSensorStatus(sensorData.temperature, 18, 28) === "bajo"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                }`}
              >
                {getSensorStatus(sensorData.temperature, 18, 28) === "optimo"
                  ? "✅ Óptima"
                  : getSensorStatus(sensorData.temperature, 18, 28) === "alto"
                    ? "🔥 Alta"
                    : getSensorStatus(sensorData.temperature, 18, 28) === "bajo"
                      ? "❄️ Baja"
                      : "⚪ Sin datos"}
              </div>
            </CardContent>
          </Card>

          {/* Humedad */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Humedad</p>
                  <p className="text-3xl font-bold text-blue-800">{sensorData.humidity?.toFixed(1) || "--"}%</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Droplets className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                  getSensorStatus(sensorData.humidity, 50, 70) === "optimo"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {getSensorStatus(sensorData.humidity, 50, 70) === "optimo" ? "✅ Buena" : "⚠️ Revisar"}
              </div>
            </CardContent>
          </Card>

          {/* Humedad del Suelo */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-50 to-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">Suelo</p>
                  <p className="text-3xl font-bold text-amber-800">{sensorData.soilMoisture?.toFixed(1) || "--"}%</p>
                </div>
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Leaf className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                  getSensorStatus(sensorData.soilMoisture, 30, 80) === "optimo"
                    ? "bg-green-100 text-green-700"
                    : getSensorStatus(sensorData.soilMoisture, 30, 80) === "bajo"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                {getSensorStatus(sensorData.soilMoisture, 30, 80) === "optimo"
                  ? "✅ Húmedo"
                  : getSensorStatus(sensorData.soilMoisture, 30, 80) === "bajo"
                    ? "🚨 Regar"
                    : "💧 Muy húmedo"}
              </div>
            </CardContent>
          </Card>

          {/* Luz */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-orange-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Luz</p>
                  <p className="text-3xl font-bold text-yellow-800">{sensorData.lightLevel?.toFixed(0) || "--"}%</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-xl">
                  <Sun className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                  getSensorStatus(sensorData.lightLevel, 30, 100) === "optimo"
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {getSensorStatus(sensorData.lightLevel, 30, 100) === "optimo" ? "☀️ Buena" : "💡 Insuficiente"}
              </div>
            </CardContent>
          </Card>

          {/* pH */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">pH</p>
                  <p className="text-3xl font-bold text-purple-800">{sensorData.pH?.toFixed(1) || "--"}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Gauge className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                  getSensorStatus(sensorData.pH, 6.0, 7.0) === "optimo"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {getSensorStatus(sensorData.pH, 6.0, 7.0) === "optimo" ? "⚖️ Neutro" : "⚗️ Ajustar"}
              </div>
            </CardContent>
          </Card>

          {/* Nutrientes */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-green-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Nutrientes</p>
                  <p className="text-3xl font-bold text-emerald-800">{sensorData.nutrients?.toFixed(0) || "--"}%</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <Zap className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                  getSensorStatus(sensorData.nutrients, 30, 100) === "optimo"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {getSensorStatus(sensorData.nutrients, 30, 100) === "optimo" ? "🌿 Bueno" : "🧪 Fertilizar"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Probador de Conexión */}
        <MqttTester />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Panel de Datos en Tiempo Real */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6" />
                  Datos en Tiempo Real
                </CardTitle>
                <CardDescription className="text-green-100">
                  Información recibida desde tus sensores Arduino
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ScrollArea className="h-96">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <div className="p-4 bg-green-50 rounded-xl inline-block mb-4">
                        <Settings2 className="w-12 h-12 text-green-500" />
                      </div>
                      <p className="text-lg font-medium">Esperando datos de Arduino...</p>
                      <p className="text-sm mt-2">Verifica que tu sistema esté enviando datos a los topics correctos</p>
                      <div className="mt-4 text-xs bg-blue-50 p-3 rounded-lg">
                        <p className="font-medium text-blue-800">Topics esperados:</p>
                        <p className="text-blue-600">smartfarm/sensors/*, arduino/data/*, VicUPN/farm/*</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg, index) => (
                        <div
                          key={index}
                          className="border border-green-100 rounded-xl p-4 bg-gradient-to-r from-white to-green-50/30"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {msg.topic}
                            </Badge>
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                              {msg.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-sm font-mono text-gray-800">{msg.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Asistente IA */}
          <div>
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm h-fit">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3">
                  <Bot className="w-6 h-6" />
                  Asistente Agrícola IA
                </CardTitle>
                <CardDescription className="text-blue-100">Consulta sobre el estado de tus cultivos</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ScrollArea className="h-64 mb-6">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <div className="p-3 bg-blue-50 rounded-xl inline-block mb-3">
                        <Bot className="w-8 h-8 text-blue-500" />
                      </div>
                      <p className="text-sm font-medium">¡Hola! Soy tu asistente de cultivo inteligente.</p>
                      <p className="text-xs mt-2 text-gray-400">
                        Pregúntame sobre temperatura, humedad, suelo, pH, nutrientes o el estado general.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatMessages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-xl p-3 text-sm ${
                              msg.type === "user"
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                : "bg-gray-100 text-gray-800 border border-gray-200"
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <Separator className="mb-4" />

                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Pregunta sobre tus cultivos..."
                    className="flex-1 border-green-200 focus:border-green-400"
                  />
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Estadísticas del Sistema */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Mensajes Recibidos</p>
                  <p className="text-3xl font-bold">{messages.length}</p>
                </div>
                <Activity className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Sensores Activos</p>
                  <p className="text-3xl font-bold">{Object.keys(sensorData).length}</p>
                </div>
                <Gauge className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Estado Sistema</p>
                  <p className="text-xl font-bold">{isConnected ? "Activo" : "Inactivo"}</p>
                </div>
                {isConnected ? (
                  <Wifi className="w-8 h-8 text-purple-200" />
                ) : (
                  <WifiOff className="w-8 h-8 text-purple-200" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Última Actualización</p>
                  <p className="text-sm font-medium">
                    {messages.length > 0 ? messages[0].timestamp.toLocaleTimeString() : "N/A"}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
