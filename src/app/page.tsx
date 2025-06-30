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
  Droplets,
  Sun,
  Activity,
  Gauge,
  Leaf,
  Settings2,
  TrendingUp,
  AlertTriangle,
  X,
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
  soilHumidity?: number // H = Humedad del suelo
  waterDistance?: number // D = Distancia del nivel del agua
  ambientLight?: number // L = Luz del ambiente
}

export default function SmartFarmDashboard() {
  const [client, setClient] = useState<mqtt.MqttClient | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<MqttMessage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [connectionStatus, setConnectionStatus] = useState("Desconectado")
  const [sensorData, setSensorData] = useState<SensorData>({})
  const [showChat, setShowChat] = useState(false)
  const [showTester, setShowTester] = useState(false)

  // Configuración MQTT para sistema de cultivo
  const mqttConfig = {
    host: process.env.NEXT_PUBLIC_MQTT_HOST || "5c7e9968188d442585b4d705796ecfac.s1.eu.hivemq.cloud",
    port: Number.parseInt(process.env.NEXT_PUBLIC_MQTT_PORT || "8884"),
    protocol: (process.env.NEXT_PUBLIC_MQTT_PROTOCOL as "ws" | "wss") || "wss",
    username: process.env.NEXT_PUBLIC_MQTT_USERNAME || "Cosme",
    password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || "Upn2025UG",
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
      const farmTopics = ["Sensores/7", "Sensores/ChatLog"]

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
      const messageStr = message.toString()
      console.log(`📊 Datos recibidos en ${topic}:`, messageStr)

      const newMessage: MqttMessage = {
        topic,
        message: messageStr,
        timestamp: new Date(),
      }
      setMessages((prev) => [newMessage, ...prev.slice(0, 49)])

      // Procesar datos de sensores directamente con el string del mensaje
      updateSensorData(topic, messageStr)
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

  const updateSensorData = (topic: string, message: string) => {
    console.log(`🔍 Procesando mensaje del topic ${topic}:`, message)

    // Parsear formato H:0,D:24,L:5 para ambos topics de sensores
    if (topic === "Sensores/7" || topic === "Sensores/ChatLog") {
      // Verificar si el mensaje tiene el formato correcto H:X,D:X,L:X
      if (message.includes("H:") && message.includes("D:") && message.includes("L:")) {
        console.log(`✅ Formato válido detectado: ${message}`)

        setSensorData((prev) => {
          const newData = { ...prev }
          const parts = message.split(",")

          parts.forEach((part: string) => {
            const trimmedPart = part.trim()
            const [key, value] = trimmedPart.split(":")

            if (key && value) {
              const numValue = Number.parseFloat(value)

              if (key === "H" && !isNaN(numValue)) {
                newData.soilHumidity = numValue
                console.log(`✅ Humedad del suelo actualizada: ${numValue}%`)
              }
              if (key === "D" && !isNaN(numValue)) {
                newData.waterDistance = numValue
                console.log(`✅ Distancia del agua actualizada: ${numValue}cm`)
              }
              if (key === "L" && !isNaN(numValue)) {
                newData.ambientLight = numValue
                console.log(`✅ Luz ambiente actualizada: ${numValue}%`)
              }
            }
          })

          console.log(`📊 Datos de sensores actualizados:`, newData)
          return newData
        })
      } else {
        console.log(`⚠️ Formato de mensaje no reconocido: ${message}`)
      }
    }
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

    if (lowerInput.includes("humedad") || lowerInput.includes("suelo")) {
      if (sensors.soilHumidity !== undefined) {
        const status = sensors.soilHumidity > 70 ? "muy húmedo" : sensors.soilHumidity < 30 ? "seco" : "adecuado"
        const advice =
          sensors.soilHumidity < 30
            ? " ¡Necesita riego urgente!"
            : sensors.soilHumidity > 80
              ? " Cuidado con el exceso de agua."
              : " Nivel perfecto para el crecimiento."
        return `🌱 Humedad del suelo: ${sensors.soilHumidity}% (${status}).${advice}`
      }
      return "🌱 No hay datos de humedad del suelo. Verifica que el sensor esté enviando datos en formato H:XX."
    }

    if (lowerInput.includes("agua") || lowerInput.includes("nivel") || lowerInput.includes("distancia")) {
      if (sensors.waterDistance !== undefined) {
        const status =
          sensors.waterDistance > 25
            ? "muy bajo"
            : sensors.waterDistance > 15
              ? "bajo"
              : sensors.waterDistance < 5
                ? "lleno"
                : "normal"
        const advice =
          sensors.waterDistance > 20
            ? " ¡Revisar y rellenar el depósito!"
            : sensors.waterDistance < 5
              ? " Depósito lleno, perfecto."
              : " Nivel adecuado."
        return `💧 Distancia del agua: ${sensors.waterDistance}cm (${status}).${advice}`
      }
      return "💧 No hay datos del nivel de agua. Verifica que el sensor esté enviando datos en formato D:XX."
    }

    if (lowerInput.includes("luz") || lowerInput.includes("iluminación")) {
      if (sensors.ambientLight !== undefined) {
        const status =
          sensors.ambientLight > 70
            ? "excelente"
            : sensors.ambientLight > 40
              ? "buena"
              : sensors.ambientLight > 20
                ? "regular"
                : "muy baja"
        const advice =
          sensors.ambientLight < 30
            ? " Considera mejorar la iluminación o mover las plantas."
            : sensors.ambientLight > 80
              ? " Excelente para fotosíntesis."
              : " Nivel aceptable."
        return `☀️ Luz ambiente: ${sensors.ambientLight}% (${status}).${advice}`
      }
      return "☀️ No hay datos de luz ambiente. Verifica que el sensor esté enviando datos en formato L:XX."
    }

    if (lowerInput.includes("estado") || lowerInput.includes("resumen") || lowerInput.includes("todo")) {
      const alerts = []
      const details = []

      if (sensors.soilHumidity !== undefined) {
        details.push(`Humedad: ${sensors.soilHumidity}%`)
        if (sensors.soilHumidity < 30) alerts.push("riego urgente")
      }

      if (sensors.waterDistance !== undefined) {
        details.push(`Agua: ${sensors.waterDistance}cm`)
        if (sensors.waterDistance > 20) alerts.push("rellenar depósito")
      }

      if (sensors.ambientLight !== undefined) {
        details.push(`Luz: ${sensors.ambientLight}%`)
        if (sensors.ambientLight < 30) alerts.push("mejorar iluminación")
      }

      const statusText = details.length > 0 ? details.join(", ") : "Sin datos de sensores"
      const alertText = alerts.length === 0 ? "✅ Todo normal" : `⚠️ Atención: ${alerts.join(", ")}`

      return `📊 Estado actual: ${statusText}. ${alertText}. Mensajes recibidos: ${mqttMessages.length}.`
    }

    if (lowerInput.includes("formato") || lowerInput.includes("datos") || lowerInput.includes("sensores")) {
      return `🔧 Formato esperado: H:XX,D:XX,L:XX donde H=humedad del suelo (%), D=distancia agua (cm), L=luz ambiente (%). Sensores activos: ${Object.keys(sensors).length}/3.`
    }

    return `🤖 Hola! Pregúntame sobre: humedad del suelo, nivel de agua, luz ambiente, estado general, o formato de datos. Ejemplo de datos: H:73,D:23,L:5`
  }

  const getSensorStatus = (value: number | undefined, min: number, max: number) => {
    if (value === undefined) return "sin-datos"
    if (value < min) return "bajo"
    if (value > max) return "alto"
    return "optimo"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8">
        {/* Header Móvil Optimizado */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-4 sm:p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative">
            <div className="flex items-start justify-between mb-4 sm:mb-0">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl backdrop-blur-sm">
                  <Sprout className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-4xl font-bold leading-tight">Smart Farm</h1>
                  <p className="text-green-100 text-sm sm:text-lg">Sistema de Cultivo Inteligente</p>
                </div>
              </div>

              {/* Botones móviles */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                  className="sm:hidden bg-white/20 text-white hover:bg-white/30"
                >
                  <Bot className="w-4 h-4 mr-1" />
                  Chat
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTester(!showTester)}
                  className="sm:hidden bg-white/20 text-white hover:bg-white/30"
                >
                  <Settings2 className="w-4 h-4 mr-1" />
                  Test
                </Button>
              </div>
            </div>

            {/* Estado de conexión */}
            <div className="flex items-center justify-center sm:justify-end">
              {isConnected ? (
                <Badge className="bg-green-500/20 text-green-100 border-green-300/30 px-3 py-1 text-xs sm:text-sm">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  {connectionStatus}
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-100 border-red-300/30 px-3 py-1 text-xs sm:text-sm">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  {connectionStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Métricas de Sensores - Solo 3 sensores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
          {/* Humedad del Suelo */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-50 to-yellow-50">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="mb-2 sm:mb-0">
                  <p className="text-xs sm:text-sm font-medium text-amber-600">Humedad Suelo</p>
                  <p className="text-lg sm:text-3xl font-bold text-amber-800">
                    {sensorData.soilHumidity?.toFixed(1) || "--"}
                    <span className="text-sm sm:text-lg">%</span>
                  </p>
                </div>
                <div className="p-2 sm:p-3 bg-amber-100 rounded-lg sm:rounded-xl self-end sm:self-auto">
                  <Leaf className="w-4 h-4 sm:w-6 sm:h-6 text-amber-600" />
                </div>
              </div>
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                  getSensorStatus(sensorData.soilHumidity, 30, 80) === "optimo"
                    ? "bg-green-100 text-green-700"
                    : getSensorStatus(sensorData.soilHumidity, 30, 80) === "bajo"
                      ? "bg-red-100 text-red-700"
                      : getSensorStatus(sensorData.soilHumidity, 30, 80) === "alto"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                }`}
              >
                {sensorData.soilHumidity === undefined
                  ? "⚪ Sin datos"
                  : getSensorStatus(sensorData.soilHumidity, 30, 80) === "optimo"
                    ? "✅ Húmedo"
                    : getSensorStatus(sensorData.soilHumidity, 30, 80) === "bajo"
                      ? "🚨 Regar"
                      : "💧 Muy húmedo"}
              </div>
            </CardContent>
          </Card>

          {/* Distancia Agua */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="mb-2 sm:mb-0">
                  <p className="text-xs sm:text-sm font-medium text-blue-600">Nivel Agua</p>
                  <p className="text-lg sm:text-3xl font-bold text-blue-800">
                    {sensorData.waterDistance?.toFixed(1) || "--"}
                    <span className="text-sm sm:text-lg">cm</span>
                  </p>
                </div>
                <div className="p-2 sm:p-3 bg-blue-100 rounded-lg sm:rounded-xl self-end sm:self-auto">
                  <Droplets className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                </div>
              </div>
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                  getSensorStatus(sensorData.waterDistance, 5, 20) === "optimo"
                    ? "bg-green-100 text-green-700"
                    : getSensorStatus(sensorData.waterDistance, 5, 20) === "alto"
                      ? "bg-red-100 text-red-700"
                      : getSensorStatus(sensorData.waterDistance, 5, 20) === "bajo"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-700"
                }`}
              >
                {sensorData.waterDistance === undefined
                  ? "⚪ Sin datos"
                  : getSensorStatus(sensorData.waterDistance, 5, 20) === "optimo"
                    ? "✅ Normal"
                    : getSensorStatus(sensorData.waterDistance, 5, 20) === "alto"
                      ? "⚠️ Bajo"
                      : "💧 Lleno"}
              </div>
            </CardContent>
          </Card>

          {/* Luz Ambiente */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-orange-50">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="mb-2 sm:mb-0">
                  <p className="text-xs sm:text-sm font-medium text-yellow-600">Luz Ambiente</p>
                  <p className="text-lg sm:text-3xl font-bold text-yellow-800">
                    {sensorData.ambientLight?.toFixed(0) || "--"}
                    <span className="text-sm sm:text-lg">%</span>
                  </p>
                </div>
                <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg sm:rounded-xl self-end sm:self-auto">
                  <Sun className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-600" />
                </div>
              </div>
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                  getSensorStatus(sensorData.ambientLight, 30, 100) === "optimo"
                    ? "bg-green-100 text-green-700"
                    : getSensorStatus(sensorData.ambientLight, 30, 100) === "bajo"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {sensorData.ambientLight === undefined
                  ? "⚪ Sin datos"
                  : getSensorStatus(sensorData.ambientLight, 30, 100) === "optimo"
                    ? "☀️ Buena"
                    : "💡 Insuficiente"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Probador de Conexión - Solo visible cuando se activa */}
        {showTester && <MqttTester />}

        {/* Layout Principal - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Panel de Datos en Tiempo Real */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-lg p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                  Datos en Tiempo Real
                </CardTitle>
                <CardDescription className="text-green-100 text-sm">
                  Información recibida desde tus sensores Arduino
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <ScrollArea className="h-64 sm:h-96">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 sm:py-12">
                      <div className="p-3 sm:p-4 bg-green-50 rounded-xl inline-block mb-3 sm:mb-4">
                        <Settings2 className="w-8 h-8 sm:w-12 sm:h-12 text-green-500" />
                      </div>
                      <p className="text-base sm:text-lg font-medium">Esperando datos de Arduino...</p>
                      <p className="text-xs sm:text-sm mt-2">
                        Verifica que tu sistema esté enviando datos a los topics correctos
                      </p>
                      <div className="mt-3 sm:mt-4 text-xs bg-blue-50 p-2 sm:p-3 rounded-lg">
                        <p className="font-medium text-blue-800">Topics esperados:</p>
                        <p className="text-blue-600 break-all">Sensores/7, Sensores/ChatLog</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {messages.map((msg, index) => (
                        <div
                          key={index}
                          className="border border-green-100 rounded-lg sm:rounded-xl p-3 sm:p-4 bg-gradient-to-r from-white to-green-50/30"
                        >
                          <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              <span className="truncate max-w-[120px] sm:max-w-none">{msg.topic}</span>
                            </Badge>
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full whitespace-nowrap">
                              {msg.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs sm:text-sm font-mono text-gray-800 break-all">{msg.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Asistente IA - Responsive */}
          <div className={`order-1 lg:order-2 ${showChat ? "block" : "hidden lg:block"}`}>
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm h-fit">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg p-4 sm:p-6">
                <CardTitle className="flex items-center justify-between text-lg sm:text-xl">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                    Asistente IA
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowChat(false)}
                    className="lg:hidden text-white hover:bg-white/20"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </CardTitle>
                <CardDescription className="text-blue-100 text-sm">
                  Consulta sobre el estado de tus cultivos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <ScrollArea className="h-48 sm:h-64 mb-4 sm:mb-6">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-6 sm:py-8">
                      <div className="p-2 sm:p-3 bg-blue-50 rounded-xl inline-block mb-2 sm:mb-3">
                        <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                      </div>
                      <p className="text-sm font-medium">¡Hola! Soy tu asistente de cultivo inteligente.</p>
                      <p className="text-xs mt-2 text-gray-400">
                        Pregúntame sobre humedad, agua, luz o el estado general.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {chatMessages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-xl p-2 sm:p-3 text-xs sm:text-sm ${
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

                <Separator className="mb-3 sm:mb-4" />

                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Pregunta sobre tus cultivos..."
                    className="flex-1 border-green-200 focus:border-green-400 text-sm"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 px-3"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Estadísticas del Sistema - Grid Responsivo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-xs sm:text-sm">Mensajes</p>
                  <p className="text-xl sm:text-3xl font-bold">{messages.length}</p>
                </div>
                <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs sm:text-sm">Sensores</p>
                  <p className="text-xl sm:text-3xl font-bold">{Object.keys(sensorData).length}/3</p>
                </div>
                <Gauge className="w-6 h-6 sm:w-8 sm:h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-xs sm:text-sm">Estado</p>
                  <p className="text-sm sm:text-xl font-bold">{isConnected ? "Activo" : "Inactivo"}</p>
                </div>
                {isConnected ? (
                  <Wifi className="w-6 h-6 sm:w-8 sm:h-8 text-purple-200" />
                ) : (
                  <WifiOff className="w-6 h-6 sm:w-8 sm:h-8 text-purple-200" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-xs sm:text-sm">Última Act.</p>
                  <p className="text-xs sm:text-sm font-medium">
                    {messages.length > 0 ? messages[0].timestamp.toLocaleTimeString() : "N/A"}
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botón flotante para chat en móvil */}
        {!showChat && (
          <Button
            onClick={() => setShowChat(true)}
            className="lg:hidden fixed bottom-4 right-4 z-50 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg rounded-full w-14 h-14"
          >
            <Bot className="w-6 h-6" />
          </Button>
        )}
      </div>
    </div>
  )
}
