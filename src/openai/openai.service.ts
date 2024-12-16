import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { response } from 'express';
import { AssistantSession } from './openai.types';
import { throws } from 'assert';

@Injectable()
export class OpenaiService {
  sessions: AssistantSession[] = [];

  async textCompletion(context: string, prompt: string, sessionId: string, name: string) {
    let session = this.sessions.find(x => x.sessionId === sessionId);

    if (!session) {
      session = {
        lastInteraction: new Date(),
        sessionId,
        messages: [
          {
            role: 'system',
            content: context
          }
        ]
      };

      this.sessions.push(session);
    }

    session.messages.push({
      role: 'user',
      content: name + ": " + prompt
    });

    const axiosResponse = await axios.post(
      `${process.env.OPENAI_URL}/chat/completions`,
      {
        model: 'gpt-4o',
        messages: session.messages,
        response_format: {
          type: 'json_object'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_APIKEY}`
        }
      }
    );

    const responseText = axiosResponse.data.choices[0].message.content;

    session.lastInteraction = new Date();
    session.messages.push({
      role: 'assistant',
      content: responseText
    });

    return JSON.parse(responseText);
  }
}


