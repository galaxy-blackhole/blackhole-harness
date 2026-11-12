/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-terminal-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

export const TYPERT_REMOTE = createTypertRemoteInfo({
  package: '@galaxy-blackhole/gbh-api-terminal-controller',
  methods: {
    'terminal/attach': {
      service: 'terminalController',
      description: 'Attach terminal input and output to one physical Remote stream.',
      mode: 'stream',
      invocation: { kind: 'direct' },
      scope: {
        context: 'agent',
        wire: 'agentId',
      },
      parameters: [
        {
          name: 'agent',
          wire: 'agentId',
          description: 'Session owner supplied by the Gateway.',
          source: 'lookup',
          lookup: 'agent',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_0$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_0_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
        {
          name: 'id',
          description: 'terminal identity.',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#WebTerminalId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_1$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#WebTerminalId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_attach_parameter_1_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
      ],
      uplink: {
        codec: {
          mode: 'strict',
          typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#TerminalInput',
          create: _deepseek_ai_dsh_api_terminal_controller_terminal_attach_uplink$schema,
        },
      },
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#TerminalFrame',
        create: _deepseek_ai_dsh_api_terminal_controller_terminal_attach_result$schema,
        description: 'screen recovery, output, writable state and provider-acceptance acknowledgements.',
        jsonSchema: {"oneOf":[{"type":"object","properties":{"type":{"type":"string","const":"snapshot"},"sequence":{"type":"number"},"screen":{"type":"string"},"info":{"type":"object","properties":{"id":{"type":"string"},"title":{"type":"string"},"shell":{"type":"object","properties":{"path":{"type":"string"},"args":{"type":"array","items":{"type":"string"}},"name":{"type":"string"}},"required":["path","args","name"],"additionalProperties":true},"cwd":{"type":"string","description":"Initial working directory; shell directory changes do not update this field."},"cols":{"type":"number"},"rows":{"type":"number"},"state":{"type":"string","enum":["failed","running","exited"]},"exitCode":{"oneOf":[{"type":"null","const":null},{"type":"number"}]},"error":{"type":"string"}},"required":["id","title","shell","cwd","cols","rows","state","exitCode"],"additionalProperties":true},"writable":{"type":"boolean"},"inputWindow":{"type":"object","properties":{"maxBytes":{"type":"number","description":"Maximum complete encoded frame bytes waiting for the Host consumer."},"frameOverheadBytes":{"type":"number","description":"UTF-8 envelope bytes added to a compact JSON item with a present value field."}},"required":["maxBytes","frameOverheadBytes"],"additionalProperties":true}},"required":["type","sequence","screen","info","writable"],"additionalProperties":true},{"type":"object","properties":{"type":{"type":"string","const":"output"},"sequence":{"type":"number"},"data":{"type":"string"}},"required":["type","sequence","data"],"additionalProperties":true},{"type":"object","properties":{"type":{"type":"string","const":"state"},"info":{"type":"object","properties":{"id":{"type":"string"},"title":{"type":"string"},"shell":{"type":"object","properties":{"path":{"type":"string"},"args":{"type":"array","items":{"type":"string"}},"name":{"type":"string"}},"required":["path","args","name"],"additionalProperties":true},"cwd":{"type":"string","description":"Initial working directory; shell directory changes do not update this field."},"cols":{"type":"number"},"rows":{"type":"number"},"state":{"type":"string","enum":["failed","running","exited"]},"exitCode":{"oneOf":[{"type":"null","const":null},{"type":"number"}]},"error":{"type":"string"}},"required":["id","title","shell","cwd","cols","rows","state","exitCode"],"additionalProperties":true},"writable":{"type":"boolean"}},"required":["type","info","writable"],"additionalProperties":true},{"type":"object","properties":{"type":{"type":"string","const":"ack"},"sequence":{"type":"number"},"refusal":{"type":"string","enum":["read-only","not-running"]}},"required":["type","sequence"],"additionalProperties":true}]},
      },
      sourceLocation: {"file":"packages/api/terminal-controller/src/index.ts","line":216,"column":3},
    },
    'terminal/close': {
      service: 'terminalController',
      description: 'Close an identity to future creation and kill its process range; repeated closes succeed.',
      invocation: { kind: 'direct' },
      scope: {
        context: 'agent',
        wire: 'agentId',
      },
      parameters: [
        {
          name: 'agent',
          wire: 'agentId',
          description: 'Session owner supplied by the Gateway.',
          source: 'lookup',
          lookup: 'agent',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_0$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_0_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
        {
          name: 'id',
          description: 'terminal identity.',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#WebTerminalId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_1$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#WebTerminalId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_close_parameter_1_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller#terminal/close:result',
        create: _deepseek_ai_dsh_api_terminal_controller_terminal_close_result$schema,
        description: 'after provider cleanup succeeds. A failure retains the terminal for retry.',
        jsonSchemaError: 'typert tool schema: unsupported void value',
      },
      sourceLocation: {"file":"packages/api/terminal-controller/src/index.ts","line":241,"column":9},
    },
    'terminal/create': {
      service: 'terminalController',
      description: 'Allocate a user shell once for a caller-generated identity, without Agent sandbox or approval restrictions.',
      invocation: { kind: 'direct' },
      scope: {
        context: 'agent',
        wire: 'agentId',
      },
      parameters: [
        {
          name: 'agent',
          wire: 'agentId',
          description: 'Session owner supplied by the Gateway.',
          source: 'lookup',
          lookup: 'agent',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_0$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_0_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
        {
          name: 'request',
          description: 'initial dimensions and idempotency identity.',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#TerminalCreateRequest',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_1$schema,
            jsonSchema: {"type":"object","properties":{"shellPath":{"type":"string","description":"A path returned by shell discovery; absent selects the execution default."},"id":{"type":"string"},"cols":{"type":"number"},"rows":{"type":"number"}},"required":["id","cols","rows"],"additionalProperties":true},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#TerminalCreateRequest',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_create_parameter_1_strict$schema,
            jsonSchema: {"type":"object","properties":{"shellPath":{"type":"string","description":"A path returned by shell discovery; absent selects the execution default."},"id":{"type":"string"},"cols":{"type":"number"},"rows":{"type":"number"}},"required":["id","cols","rows"],"additionalProperties":false},
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#WebTerminalInfo',
        create: _deepseek_ai_dsh_api_terminal_controller_terminal_create_result$schema,
        description: 'the existing or newly committed terminal.',
        jsonSchema: {"type":"object","properties":{"id":{"type":"string"},"title":{"type":"string"},"shell":{"type":"object","properties":{"path":{"type":"string"},"args":{"type":"array","items":{"type":"string"}},"name":{"type":"string"}},"required":["path","args","name"],"additionalProperties":true},"cwd":{"type":"string","description":"Initial working directory; shell directory changes do not update this field."},"cols":{"type":"number"},"rows":{"type":"number"},"state":{"type":"string","enum":["failed","running","exited"]},"exitCode":{"oneOf":[{"type":"null","const":null},{"type":"number"}]},"error":{"type":"string"}},"required":["id","title","shell","cwd","cols","rows","state","exitCode"],"additionalProperties":true},
      },
      sourceLocation: {"file":"packages/api/terminal-controller/src/index.ts","line":159,"column":9},
    },
    'terminal/environment': {
      service: 'terminalController',
      description: 'Read the Session\'s current directory and terminal limits without filesystem validation or shell lookup.',
      invocation: { kind: 'direct' },
      scope: {
        context: 'agent',
        wire: 'agentId',
      },
      parameters: [
        {
          name: 'agent',
          wire: 'agentId',
          description: 'Session owner supplied by the Gateway.',
          source: 'lookup',
          lookup: 'agent',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_environment_parameter_0$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_environment_parameter_0_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#TerminalEnvironment',
        create: _deepseek_ai_dsh_api_terminal_controller_terminal_environment_result$schema,
        description: 'the logged current directory and terminal limits; retained terminals keep their own process directories.',
        jsonSchema: {"type":"object","properties":{"cwd":{"type":"string","description":"Logged current directory, read without filesystem validation."},"maxInputBytes":{"type":"number"},"maxBufferedBytes":{"type":"number","description":"Maximum complete encoded Client input bytes retained until acknowledgement."},"maxCols":{"type":"number"},"maxRows":{"type":"number"},"scrollback":{"type":"number"}},"required":["cwd","maxInputBytes","maxBufferedBytes","maxCols","maxRows","scrollback"],"additionalProperties":true},
      },
      sourceLocation: {"file":"packages/api/terminal-controller/src/index.ts","line":119,"column":3},
    },
    'terminal/list': {
      service: 'terminalController',
      description: 'List retained terminals without resolving or activating an Agent.',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'sessionId',
          description: 'displayed Session identity, including offline history.',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_list_parameter_0$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_list_parameter_0_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller#terminal/list:result',
        create: _deepseek_ai_dsh_api_terminal_controller_terminal_list_result$schema,
        description: 'terminals retained for this Host lifetime.',
        jsonSchema: {"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"title":{"type":"string"},"shell":{"type":"object","properties":{"path":{"type":"string"},"args":{"type":"array","items":{"type":"string"}},"name":{"type":"string"}},"required":["path","args","name"],"additionalProperties":true},"cwd":{"type":"string","description":"Initial working directory; shell directory changes do not update this field."},"cols":{"type":"number"},"rows":{"type":"number"},"state":{"type":"string","enum":["failed","running","exited"]},"exitCode":{"oneOf":[{"type":"null","const":null},{"type":"number"}]},"error":{"type":"string"}},"required":["id","title","shell","cwd","cols","rows","state","exitCode"],"additionalProperties":true}},
      },
      sourceLocation: {"file":"packages/api/terminal-controller/src/index.ts","line":145,"column":3},
    },
    'terminal/rename': {
      service: 'terminalController',
      description: 'Rename a terminal without changing its shell.',
      invocation: { kind: 'direct' },
      scope: {
        context: 'agent',
        wire: 'agentId',
      },
      parameters: [
        {
          name: 'agent',
          wire: 'agentId',
          description: 'Session owner supplied by the Gateway.',
          source: 'lookup',
          lookup: 'agent',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_0$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_0_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
        {
          name: 'id',
          description: 'terminal identity.',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#WebTerminalId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_1$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#WebTerminalId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_1_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
        {
          name: 'title',
          description: 'nonempty display title, at most 120 characters.',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller#terminal/rename:title',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_2$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller#terminal/rename:title',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_rename_parameter_2_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller#terminal/rename:result',
        create: _deepseek_ai_dsh_api_terminal_controller_terminal_rename_result$schema,
        jsonSchemaError: 'typert tool schema: unsupported void value',
      },
      sourceLocation: {"file":"packages/api/terminal-controller/src/index.ts","line":229,"column":3},
    },
    'terminal/retain': {
      service: 'terminalController',
      description: 'Retain an existing terminal for a window without activating its Agent or taking input control.',
      mode: 'stream',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'sessionId',
          description: 'owning Session identity, including an inactive saved layout.',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_0$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_0_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
        {
          name: 'id',
          description: 'retained Host terminal identity.',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#WebTerminalId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_1$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#WebTerminalId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_retain_parameter_1_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller/types#TerminalRetentionFrame',
        create: _deepseek_ai_dsh_api_terminal_controller_terminal_retain_result$schema,
        description: 'a hold acknowledgement followed by an open lifetime stream.',
        jsonSchema: {"type":"object","properties":{"type":{"type":"string","const":"retained"}},"required":["type"],"additionalProperties":true},
      },
      sourceLocation: {"file":"packages/api/terminal-controller/src/index.ts","line":199,"column":3},
    },
    'terminal/shells': {
      service: 'terminalController',
      description: 'Discover installed shells in the Session\'s execution environment.',
      invocation: { kind: 'direct' },
      scope: {
        context: 'agent',
        wire: 'agentId',
      },
      parameters: [
        {
          name: 'agent',
          wire: 'agentId',
          description: 'Session owner supplied by the Gateway.',
          source: 'lookup',
          lookup: 'agent',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_shells_parameter_0$schema,
            jsonSchema: {"type":"string"},
          },
          strictCodec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            create: _deepseek_ai_dsh_api_terminal_controller_terminal_shells_parameter_0_strict$schema,
            jsonSchema: {"type":"string"},
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: '@galaxy-blackhole/gbh-api-terminal-controller#terminal/shells:result',
        create: _deepseek_ai_dsh_api_terminal_controller_terminal_shells_result$schema,
        description: 'verified profiles, with the configured or system default first.',
        jsonSchema: {"type":"array","items":{"type":"object","properties":{"path":{"type":"string"},"args":{"type":"array","items":{"type":"string"}},"name":{"type":"string"}},"required":["path","args","name"],"additionalProperties":true}},
      },
      sourceLocation: {"file":"packages/api/terminal-controller/src/index.ts","line":134,"column":3},
    },
  },
}, z)

export default TYPERT_REMOTE


export {};
