type LogFields = Record<string, string | number | boolean | null | undefined>

function write(level: string, message: string, fields?: LogFields): void {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  })
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

export const log = {
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
}
