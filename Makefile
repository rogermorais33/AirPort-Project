.PHONY: help up down backend-test frontend-lint frontend-build firmware-build firmware-upload firmware-monitor firmware-wokwi

PORT ?= COM5

help:
	@echo "Targets:"
	@echo "  make up                 # sobe postgres + backend (docker compose)"
	@echo "  make down               # derruba stack docker"
	@echo "  make backend-test       # roda pytest do backend"
	@echo "  make frontend-lint      # roda lint do frontend"
	@echo "  make frontend-build     # build do frontend"
	@echo "  make firmware-build     # compila firmware ESP32-CAM"
	@echo "  make firmware-wokwi     # compila firmware para simulação Wokwi"
	@echo "  make firmware-upload    # upload firmware (PORT=$(PORT))"
	@echo "  make firmware-monitor   # monitor serial (PORT=$(PORT))"

up:
	docker compose up --build

down:
	docker compose down

backend-test:
	cd backend-fastapi && python -m pytest -q

frontend-lint:
	cd frontend-nextjs && npm run lint

frontend-build:
	cd frontend-nextjs && npm run build

firmware-build:
	python -m platformio run -d esp32-cam -e esp32-cam

firmware-wokwi:
	python -m platformio run -d esp32-cam -e esp32-wokwi

firmware-upload:
	python -m platformio run -d esp32-cam -e esp32-cam -t upload --upload-port $(PORT)

firmware-monitor:
	python -m platformio device monitor -d esp32-cam -b 115200 --port $(PORT)
