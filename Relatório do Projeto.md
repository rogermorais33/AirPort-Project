**Monitoramento Inteligente de Voláteis (Substâncias gasosas) para Detecção de Pragas em Plantações.**  
Alunos: Rogério 1969016, Willian, Cauã, Bruno, Nicolas

**Objetivo:**   
Desenvolver um "nariz eletrônico" capaz de identificar focos de pragas em plantações através da detecção de compostos orgânicos voláteis (VOCs) emitidos pelas plantas ao serem atacadas. Nosso objetivo é capturar esse "grito químico" para identificar o foco da praga antes que o dano seja visível a olho nu, reduzindo o uso indiscriminado de defensivos agrícolas.

**Ferramentas que serão usadas:**

* BME680 (Sensor): Optamos por este sensor por ser um dispositivo que integra detecção de gases, temperatura, umidade e pressão. Ele utiliza a tecnologia de Óxido Metálico (MOx) para medir a resistência do ar, o que me permite identificar mudanças sutis na composição química do ambiente.  
    
* Ngrok: Como pretendemos realizar o processamento em um servidor local, utilizaremos o Ngrok. Isso permitirá que o protótipo, mesmo operando em uma rede externa, consiga entregar os dados para a API local sem a necessidade de configurações complexas de infraestrutura de rede.  
    
* Microcontrolador ESP32: Escolhemos o ESP32 em vez do Arduino convencional pela sua conectividade Wi-Fi nativa e maior capacidade de processamento, necessária para lidar com os protocolos de comunicação e futura implementação de algoritmos de filtragem.

**Formato de Dados:**  
Os dados serão transmitidos no formato JSON. Escolhemos este formato pela sua leveza e facilidade de parsing, o que otimiza o consumo de bateria do dispositivo de campo.

**Linguagem da API:**   
Desenvolveremos a API em Python. Escolhemos Python pela vasta disponibilidade de bibliotecas de Ciência de Dados e Machine Learning, o que facilitará o treinamento de um modelo para diferenciar o "cheiro" do cultivo saudável do cultivo sob ataque.

**Banco de Dados (BD):**   
Utilizaremos o InfluxDB por ser um banco de dados ideal para o nosso projeto, pois permite armazenar e consultar com altíssima performance as variações constantes dos sensores ao longo do tempo.

**Plataforma de Prototipagem:**  
Utilizaremos o Wokwi como plataforma de prototipagem online pois diferente do Tinkercad, que é limitado a componentes básicos, o Wokwi nos permite simular o ESP32 e integrar bibliotecas reais (como a Adafruit\_BME680). Isso garante que o código testado na simulação seja mais compatível com o hardware físico. O Wokwi também nos permite simular requisições HTTP reais de dentro do navegador.  
