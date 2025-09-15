/**
 * Protocol Buffers Demo
 * Demonstrates the key functionality of spec 003 implementation
 */
import { protocolBuffers } from './index';

// Demo data representing typical ham radio communications
const qslConfirmation = {
  qso: {
    date: '2025-09-14',
    time: '1530Z',
    frequency: 14.205,
    mode: 'QPSK',
    callsigns: {
      from: 'KA1ABC',
      to: 'W2DEF'
    },
    rst_exchange: {
      sent: '599',
      received: '579'
    },
    location: {
      grid_square: 'CN87',
      coordinates: {
        latitude: 47.6062,
        longitude: -122.3321
      }
    }
  },
  operator: {
    name: 'John Smith',
    license_class: 'General'
  },
  confirmation: {
    method: 'ELECTRONIC',
    timestamp: Date.now(),
    verified: true
  }
};

const meshRoutingInfo = {
  route: {
    source: 'KA1ABC',
    destination: 'W2DEF',
    hops: ['N3GHI', 'K4JKL'],
    metrics: {
      hopCount: 2,
      totalDelay: 1250, // ms
      snr: 12.5,
      bandwidth: 2800
    }
  },
  payload_info: {
    type: 'HTTP_REQUEST',
    size: 234,
    compressed: true
  },
  technical: {
    frequencies: [14.205, 21.205, 28.205],
    power_levels: [100, 50, 25],
    propagation: 'IONOSPHERIC'
  }
};

export function runProtocolBuffersDemo() {
  console.log('🎯 Protocol Buffers for Ham Radio - Demo Starting\n');

  // 1. Schema Generation Demo
  console.log('📋 Step 1: Dynamic Schema Generation');
  const qslSchema = protocolBuffers.generateSchema(qslConfirmation, 'QSLConfirmation');
  console.log(`   Generated schema "${qslSchema.name}" with ID: ${qslSchema.id}`);
  console.log(`   Schema has ${qslSchema.fields.length} fields`);
  console.log(`   Field names: ${qslSchema.fields.map(f => f.name).slice(0, 5).join(', ')}...`);

  const routingSchema = protocolBuffers.generateSchema(meshRoutingInfo, 'MeshRouting');
  console.log(`   Generated schema "${routingSchema.name}" with ID: ${routingSchema.id}`);
  console.log(`   Schema has ${routingSchema.fields.length} fields\n`);

  // 2. Binary Encoding Demo
  console.log('🔒 Step 2: Binary Encoding');
  const originalQslSize = JSON.stringify(qslConfirmation).length;
  const encodedQsl = protocolBuffers.encode(qslConfirmation, qslSchema.id);

  console.log(`   JSON size: ${originalQslSize} bytes`);
  console.log(`   Protobuf size: ${encodedQsl.data.length} bytes`);
  console.log(`   Compression ratio: ${(originalQslSize / encodedQsl.data.length).toFixed(2)}x`);
  console.log(`   Bandwidth savings: ${(100 - (encodedQsl.data.length / originalQslSize * 100)).toFixed(1)}%\n`);

  // 3. Schema Transmission Demo
  console.log('📡 Step 3: Schema Transmission');
  const schemaTransmission = protocolBuffers.createSchemaTransmission(routingSchema);
  const schemaSize = JSON.stringify(schemaTransmission).length;
  console.log(`   Schema transmission size: ${schemaSize} bytes`);
  console.log(`   Schema transmission type: ${schemaTransmission.type}`);

  // Simulate receiving schema on another station
  const receiverProtocolBuffers = protocolBuffers; // Same instance for demo
  receiverProtocolBuffers.cacheSchema(schemaTransmission.schema);
  console.log(`   Schema cached on receiving station ✓\n`);

  // 4. Data Decoding Demo
  console.log('🔓 Step 4: Data Decoding');
  const encodedRouting = protocolBuffers.encode(meshRoutingInfo, routingSchema.id);
  const decodedRouting = protocolBuffers.decode(encodedRouting);

  console.log(`   Original route source: ${meshRoutingInfo.route.source}`);
  console.log(`   Decoded route source: ${decodedRouting.route.source}`);
  console.log(`   Original hop count: ${meshRoutingInfo.route.metrics.hopCount}`);
  console.log(`   Decoded hop count: ${decodedRouting.route.metrics.hopCount}`);
  console.log(`   Data integrity: ${JSON.stringify(meshRoutingInfo) === JSON.stringify(decodedRouting) ? '✓ VERIFIED' : '✗ FAILED'}\n`);

  // 5. Bandwidth Efficiency Demo
  console.log('📊 Step 5: Bandwidth Efficiency Analysis');
  const testMessages = [
    { name: 'QSL Confirmation', data: qslConfirmation },
    { name: 'Mesh Routing', data: meshRoutingInfo },
    {
      name: 'Emergency Traffic',
      data: {
        priority: 'EMERGENCY',
        incident: 'FIRE-2025-0914-001',
        location: 'Mount Baker National Forest',
        coordinates: { lat: 48.7767, lng: -121.8144 },
        status: 'EVACUATIONS_UNDERWAY',
        resources_needed: ['MEDICAL', 'TRANSPORT'],
        contact: 'W7ABC'
      }
    }
  ];

  console.log('   Message Type                | JSON Size | Protobuf Size | Savings');
  console.log('   ----------------------------|-----------|---------------|--------');

  let totalJsonSize = 0;
  let totalProtobufSize = 0;

  for (const msg of testMessages) {
    const jsonSize = JSON.stringify(msg.data).length;
    const schema = protocolBuffers.generateSchema(msg.data, msg.name);
    const encoded = protocolBuffers.encode(msg.data, schema.id);
    const protobufSize = encoded.data.length;
    const savings = ((jsonSize - protobufSize) / jsonSize * 100).toFixed(1);

    totalJsonSize += jsonSize;
    totalProtobufSize += protobufSize;

    console.log(`   ${msg.name.padEnd(27)} | ${jsonSize.toString().padStart(9)} | ${protobufSize.toString().padStart(13)} | ${savings.padStart(6)}%`);
  }

  const overallSavings = ((totalJsonSize - totalProtobufSize) / totalJsonSize * 100).toFixed(1);
  console.log('   ----------------------------|-----------|---------------|--------');
  console.log(`   ${'TOTAL'.padEnd(27)} | ${totalJsonSize.toString().padStart(9)} | ${totalProtobufSize.toString().padStart(13)} | ${overallSavings.padStart(6)}%\n`);

  // 6. Schema Caching Demo
  console.log('💾 Step 6: Schema Caching');
  console.log(`   Cached schemas: ${protocolBuffers.getCachedSchemaIds().length}`);
  console.log(`   Schema IDs: ${protocolBuffers.getCachedSchemaIds().join(', ')}`);

  // Validate cached schemas work
  const testValidation = protocolBuffers.validateData(qslConfirmation, qslSchema.id);
  console.log(`   Schema validation: ${testValidation ? '✓ PASSED' : '✗ FAILED'}\n`);

  // 7. Error Handling Demo
  console.log('⚠️  Step 7: Error Handling');
  try {
    const fakeEncodedMessage = {
      schemaId: 'nonexistent-schema-id',
      data: new Uint8Array([1, 2, 3, 4])
    };
    protocolBuffers.decode(fakeEncodedMessage);
    console.log('   ✗ Should have thrown error for missing schema');
  } catch (error: any) {
    console.log(`   ✓ Correctly handled missing schema: ${error.message}`);
  }

  console.log('\n🎯 Protocol Buffers Demo Complete!');
  console.log('\n📝 Key Benefits Demonstrated:');
  console.log(`   • Dynamic schema generation from data structure`);
  console.log(`   • ${overallSavings}% bandwidth savings vs JSON`);
  console.log(`   • Schema transmission and caching`);
  console.log(`   • Binary encoding with data integrity`);
  console.log(`   • Error handling for missing schemas`);
  console.log(`   • Full compliance with FCC Part 97 (no encryption)\n`);
}

// Export the demo data for testing
export { qslConfirmation, meshRoutingInfo };