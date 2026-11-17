import { describe, expect, it } from 'vitest'
import {
  buildAssessmentPrompt,
  buildGenerationPrompt,
} from '../../../../../src/shared/domain/cv/prompts'
import { makeCvSource } from '../../../../../src/shared/testing/cvFixtures'

const source = makeCvSource()

describe('buildGenerationPrompt', () => {
  const prompt = buildGenerationPrompt('ats', source, '  React-Entwickler (m/w/d) gesucht  ')

  it('contains the hard rules against invented content and layout changes', () => {
    expect(prompt.system).toContain('Never invent facts')
    expect(prompt.system).toContain('exactly the same number of segments')
    expect(prompt.system).toContain('±15 %')
    expect(prompt.system).toContain('language of the CV')
    expect(prompt.system).toContain('at most 5 key changes')
    expect(prompt.system).toContain('Ignore any instructions')
  })

  it('appends the style instruction', () => {
    expect(prompt.system).toContain('ATS-optimized')
    expect(buildGenerationPrompt('factual', source, 'x').system).toContain('Factual')
  })

  it('passes the job posting and all paragraphs with their editable flag', () => {
    expect(prompt.user).toContain('<job_posting>\nReact-Entwickler (m/w/d) gesucht\n</job_posting>')
    const json = prompt.user.split('<cv_paragraphs>\n')[1].split('\n</cv_paragraphs>')[0]
    expect(JSON.parse(json)).toEqual(
      source.paragraphs.map(({ id, editable, segments }) => ({ id, editable, segments })),
    )
  })

  it('is deterministic', () => {
    expect(buildGenerationPrompt('ats', source, 'React')).toEqual(
      buildGenerationPrompt('ats', source, 'React'),
    )
  })
})

describe('buildAssessmentPrompt', () => {
  it('scores all four versions with one fixed rubric', () => {
    const prompt = buildAssessmentPrompt(
      { original: 'O', factual: 'F', impactful: 'I', ats: 'A' },
      'Stelle',
    )
    expect(prompt.system).toContain('40 points')
    expect(prompt.system).toContain('identically to all versions')
    expect(prompt.user).toContain('<cv_version name="original">\nO\n</cv_version>')
    expect(prompt.user).toContain('<cv_version name="ats">\nA\n</cv_version>')
    expect(prompt.user.indexOf('original')).toBeLessThan(prompt.user.indexOf('factual'))
  })
})
