import schemdraw
import schemdraw.elements as elm

def draw_schematic():
    with schemdraw.Drawing(file='system_schematic.svg', show=False) as d:
        d.config(fontsize=12, unit=3, lw=1.5)

        # -------------------
        # POWER SUPPLY
        # -------------------
        d += elm.Line().right().length(2).label('12V from OBD-II')
        d += (reg := elm.VoltageRegulator().label('78L05\n(5V Reg)'))
        d += elm.Line().right().length(1.5).label('5V SYS')
        d.push()
        d += elm.Capacitor().down().label('0.1uF')
        d += elm.Ground()
        d.pop()
        
        # -------------------
        # ELM327 OBD INTERFACE
        # -------------------
        d += elm.Line().right().length(3)
        d += (elm327 := elm.Ic(pins=[
                elm.IcPin(name='Vdd', side='left', pin='1'),
                elm.IcPin(name='Vss', side='left', pin='28'),
                elm.IcPin(name='CANTX', side='top', pin='24'),
                elm.IcPin(name='CANRX', side='top', pin='23'),
                elm.IcPin(name='RS232Tx', side='right', pin='17'),
                elm.IcPin(name='RS232Rx', side='right', pin='18')
            ], edgepadW=1.5, edgepadH=1.5, leadlen=1).label('ELM327\nOBD IC', loc='bottom'))

        # CAN Transceiver (Above ELM327)
        d.push()
        d += elm.Line().at(elm327.CANTX).up().length(2)
        d += (can_xcvr := elm.Ic(pins=[
                elm.IcPin(name='TXD', side='bottom', pin='1'),
                elm.IcPin(name='RXD', side='bottom', pin='4'),
                elm.IcPin(name='CANH', side='top', pin='7'),
                elm.IcPin(name='CANL', side='top', pin='6')
            ], edgepadW=1, edgepadH=1, leadlen=1).anchor('TXD').label('MCP2551\nCAN TxRx', loc='left'))
        
        # Wire CANRX
        d += elm.Wire('|-').at(elm327.CANRX).to(can_xcvr.RXD)
        
        # OBD CAN lines
        d += elm.Line().at(can_xcvr.CANH).up().length(1).label('To OBD Pin 6 (CAN-H)', loc='right')
        d += elm.Line().at(can_xcvr.CANL).up().length(1).label('To OBD Pin 14 (CAN-L)', loc='right')
        d.pop()

        # -------------------
        # ESP32 HUB
        # -------------------
        # Place ESP32 further right and slightly down
        d.push()
        hub_x = elm327.RS232Tx[0] + 6
        hub_y = elm327.RS232Tx[1] - 2
        
        d += (esp32 := elm.Ic(pins=[
                elm.IcPin(name='RX', side='left', pin='34'),
                elm.IcPin(name='TX', side='left', pin='35'),
                elm.IcPin(name='SPI_SCK', side='right', pin='18'),
                elm.IcPin(name='SPI_MOSI', side='right', pin='23'),
                elm.IcPin(name='SPI_MISO', side='right', pin='19'),
                elm.IcPin(name='I2C_SDA', side='right', pin='21'),
                elm.IcPin(name='I2C_SCL', side='right', pin='22'),
                elm.IcPin(name='Sense_TX', side='bottom', pin='33'),
                elm.IcPin(name='Sense_RX', side='bottom', pin='32')
            ], edgepadW=2, edgepadH=2, leadlen=1).at((hub_x, hub_y)).label('ESP32 WROOM-32\n(Hub Node)', loc='top'))

        # Wire ELM327 to ESP32 Hub
        d += elm.Wire('-|').at(elm327.RS232Tx).to(esp32.RX)
        d += elm.Wire('-|').at(elm327.RS232Rx).to(esp32.TX)
        
        # -------------------
        # PERIPHERALS
        # -------------------
        # SPI lines
        d.push()
        d += elm.Line().at(esp32.SPI_MOSI).right().length(3)
        d += elm.Label().label('To LoRa (SX1278)\nand TFT Display\n(SPI Bus)')
        d.pop()

        # I2C lines
        d.push()
        d += elm.Line().at(esp32.I2C_SDA).right().length(3).color('blue')
        d += elm.Label().label('To MPU6050\n(I2C Bus)', color='blue')
        d.pop()

        # -------------------
        # SENSE NODE (ESP32-S3)
        # -------------------
        d.push()
        # Place Sense Node directly below Hub
        sense_x = esp32.Sense_TX[0]
        sense_y = esp32.Sense_TX[1] - 4
        
        d += (esp32s3 := elm.Ic(pins=[
                elm.IcPin(name='RX', side='top', pin='44'),
                elm.IcPin(name='TX', side='top', pin='43')
            ], edgepadW=1.5, edgepadH=1, leadlen=1).at((sense_x, sense_y)).anchor('RX').label('ESP32-S3\n(Sense Node)', loc='bottom'))
        
        # Wire Hub to Sense Node
        d += elm.Wire('|-').at(esp32.Sense_TX).to(esp32s3.RX)
        d += elm.Wire('|-').at(esp32.Sense_RX).to(esp32s3.TX)
        d.pop()
        
        d.pop()

if __name__ == '__main__':
    draw_schematic()
    print("Schematic saved as system_schematic.svg. You can open this in any web browser.")

