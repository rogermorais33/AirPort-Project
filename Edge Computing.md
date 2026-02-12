Edge Computing

Nosso Edge Computing vai ser aplicado na placa BME680 filtrando os dados do cheiro, temperatura e umidade, quando os dados estiverem estáveis não contendo alterações eles não serão enviados para API, mas para manter o monitoramento fora da placa, podemos mandar uma média das informações coletadas em um período de tempo, assim economizando no processamento.  
Também podemos ter uma atualização em tempo real, quando a filtragem reconhecer um valor extremamente favorável à pragas requerendo uma urgência a esp32 pode mandar o sinal direto para o drone, evitando passar pela API.

Passo a Passo:

**Leitura e Normalização:** O ESP32 lê o BME680 (Gases/VOC, Temp, Umid).  
**Análise de Desvio (Delta):** \* O sistema compara a leitura atual com a última leitura enviada.  
**Se estável:** Os dados são acumulados em um buffer interno para cálculo de média.

**Se alterado:** O sistema quebra o ciclo de espera e prepara o envio imediato.

**Detecção de Urgência (Fator Praga):** \* O ESP32 cruza os dados (ex: Alta Umidade \+ VOC específico).  
Se o padrão de "Risco de Pragas" for detectado, o ESP32 ignora a API e dispara um comando via protocolo leve (como ESP-NOW ou UDP) diretamente para o **Drone**.

**Relatório de Manutenção (Heartbeat):**  
Após X minutos de estabilidade, o ESP32 calcula a média aritmética do buffer e envia um único pacote para a API para manter o histórico atualizado.

