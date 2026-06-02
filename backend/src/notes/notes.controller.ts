import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { NotesService } from './notes.service';

interface AuthRequest {
  user: { sub: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.notesService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.notesService.findOne(id, req.user.sub);
  }

  @Post()
  create(@Body() dto: CreateNoteDto, @Request() req: AuthRequest) {
    return this.notesService.create(req.user.sub, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto, @Request() req: AuthRequest) {
    return this.notesService.update(id, req.user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.notesService.remove(id, req.user.sub);
  }
}
