import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('application stylesheet entry', () => {
  it('uses the specified SCSS source file', () => {
    const sourceDirectory = join(process.cwd(), 'src')
    const main = readFileSync(join(sourceDirectory, 'main.js'), 'utf8')

    expect(main).toContain("import './style.scss'")
    expect(existsSync(join(sourceDirectory, 'style.scss'))).toBe(true)
  })
})
