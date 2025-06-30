"use client";

import { useEffect, useState } from "react";
import mqtt from "mqtt";
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
} from "lucide-react";
import { MqttTester } from "@/components/mqtt-tester";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface MqttMessage {
  topic: string;
  message: string;
  timestamp: Date;
}

interface ChatMessage {
  type: "user" | "bot";
  content: string;
  timestamp: Date;
}

interface SensorData {
  soilHumidity?: number; // H = Humedad del suelo
  waterDistance?: number; // D = Distancia del nivel del agua
  ambientLight?: number; // L = Luz del ambiente
}

export default function SmartFarmDashboard() {
  const [client, setClient] = useState<mqtt.MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<MqttMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Desconectado");
  const [sensorData, setSensorData] = useState<SensorData>({});
  const [showChat, setShowChat] = useState(false);
  const [showTester, setShowTester] = useState(false);

  const mqttConfig = {
    host: process.env.NEXT_PUBLIC_MQTT_HOST || "5c7e9968188d442585b4d705796ecfac.s1.eu.hivemq.cloud",
    port: Number.parseInt(process.env.NEXT_PUBLIC_MQTT_PORT || "8884"),
    protocol: process.env.NEXT_PUBLIC_MQTT_PROTOCOL || "wss" as const,
    username: process.env.NEXT_PUBLIC_MQTT_USERNAME || "Cosme",
    password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || "Upn2025UG",
    clientId: `SmartFarm_${Math.random().toString(16).substr(2, 8)}`,
    keepalive: 60,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
    clean: true,
  };

  useEffect(() => {
    const connectUrl = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}/mqtt`;

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
    });

    mqttClient.on("connect", () => {
      setIsConnected(true);
      setConnectionStatus("Sistema Activo");

      const farmTopics = ["Sensores/7", "Sensores/ChatLog"];
      farmTopics.forEach((topic) => {
        mqttClient.subscribe(topic, { qos: 1 });
      });

      mqttClient.publish(
        "smartfarm/system/status",
        JSON.stringify({
          status: "Dashboard conectado",
          timestamp: new Date().toISOString(),
          clientId: mqttConfig.clientId,
        }),
        { qos: 1 }
      );
    });

    mqttClient.on("message", (topic, message) => {
      const newMessage: MqttMessage = {
        topic,
        message: message.toString(),
        timestamp: new Date(),
      };
      setMessages((prev) => [newMessage, ...prev.slice(0, 49)]);
      try {
        const data = JSON.parse(message.toString());
        updateSensorData(topic, data);
      } catch {
        updateSensorData(topic, { value: message.toString() });
      }
    });

    mqttClient.on("error", (err) => {
      setIsConnected(false);
      setConnectionStatus("Error: " + err.message);
    });

    mqttClient.on("offline", () => {
      setIsConnected(false);
      setConnectionStatus("Sistema Desconectado");
    });

    mqttClient.on("reconnect", () => {
      setConnectionStatus("Reconectando Sistema...");
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, []);

  const updateSensorData = (topic: string, data: any) => {
    setSensorData((prev) => {
      const newData = { ...prev };

      if (topic === "Sensores/ChatLog" || topic === "Sensores/7") {
        const message = typeof data === "string" ? data : data?.toString?.() || "";
        const parts = message.split(",");
        parts.forEach((part: string) => {
          const [key, value] = part.split(":").map((x) => x.trim());
          const numValue = Number.parseFloat(value);

          if (!key || isNaN(numValue)) return;

          switch (key) {
            case "H":
              newData.soilHumidity = numValue;
              break;
            case "D":
              newData.waterDistance = numValue;
              break;
            case "L":
              newData.ambientLight = numValue;
              break;
          }
        });
      }
      return newData;
    });
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      type: "user",
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
  };

  return (
    <div>
      {/* Tu interfaz aquí */}
    </div>
  );
}
